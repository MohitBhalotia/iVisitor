const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
require('dotenv').config();

const prisma = new PrismaClient();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Email configuration
let transporter;
try {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('Email transport configured');
} catch (err) {
  console.error('Failed to configure email transport:', err);
  transporter = null;
}

// Routes
// 1. Submit visitor request
app.post('/api/visitor-request', async (req, res) => {
  console.log('Received visitor request:', req.body);
  try {
    const { visitorName, visitorEmail, residentName, residentEmail, visitReason, carNumber } = req.body;
    
    // Check if resident exists
    let resident = await prisma.resident.findUnique({
      where: { email: residentEmail }
    });
    
    // Create resident if they don't exist
    if (!resident) {
      try {
        resident = await prisma.resident.create({
          data: {
            name: residentName || 'Resident',
            email: residentEmail
          }
        });
        console.log(`Created new resident: ${residentEmail}`);
      } catch (err) {
        console.error('Error creating resident:', err);
        // If there's a unique constraint error, try to fetch the resident again
        // This handles race conditions where the resident might have been created between our check and create
        if (err.code === 'P2002') { // Prisma unique constraint violation
          resident = await prisma.resident.findUnique({
            where: { email: residentEmail }
          });
          if (!resident) {
            return res.status(500).json({ error: 'Failed to create or find resident' });
          }
        } else {
          throw err;
        }
      }
    }

    // Generate unique 4-digit code
    const verificationCode = Math.floor(1000 + Math.random() * 9000);

    // Insert visitor request
    const newVisitor = await prisma.visitor.create({
      data: {
        visitorName,
        visitorEmail,
        residentName,
        residentEmail,
        visitReason,
        carNumber,
        verificationCode: verificationCode.toString(),
        status: 'pending'
      }
    });

    // Send email to resident if email transport is configured
    if (transporter) {
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER || 'noreply@ivisitor.com',
          to: newVisitor.residentEmail,
          subject: 'New Visitor Request',
          html: `
            <h2>New Visitor Request</h2>
            <p>Visitor Name: ${newVisitor.visitorName}</p>
            <p>Visitor Email: ${newVisitor.visitorEmail}</p>
            <p>Visit Reason: ${newVisitor.visitReason}</p>
            <p>Car Number: ${newVisitor.carNumber || 'Not provided'}</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/approve/${newVisitor.id}">Approve</a>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/reject/${newVisitor.id}">Reject</a>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent to resident:', newVisitor.residentEmail);
      } catch (emailErr) {
        console.error('Failed to send email, but continuing with visitor registration:', emailErr);
        // Continue with the registration even if email fails
      }
    } else {
      console.log('Email transport not configured, skipping email notification');
    }
    res.json(newVisitor);
  } catch (err) {
    console.error('Error in visitor-request endpoint:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// 2. Update visitor status (approve/reject)
app.put('/api/visitor-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updatedVisitor = await prisma.visitor.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    if (status === 'approved' && transporter) {
      try {
        // Send verification code to visitor
        const mailOptions = {
          from: process.env.EMAIL_USER || 'noreply@ivisitor.com',
          to: updatedVisitor.visitorEmail,
          subject: 'Visit Approved - Verification Code',
          html: `
            <h2>Your visit has been approved</h2>
            <p>Your verification code is: ${updatedVisitor.verificationCode}</p>
            <p>Please show this code to the guard upon arrival.</p>
          `
        };
        await transporter.sendMail(mailOptions);
        console.log('Approval email sent to visitor:', updatedVisitor.visitorEmail);
      } catch (emailErr) {
        console.error('Failed to send approval email, but continuing with status update:', emailErr);
        // Continue with the status update even if email fails
      }
    }

    res.json(updatedVisitor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Guard verification
app.post('/api/guard-verify', async (req, res) => {
  try {
    const { visitorId, code } = req.body;
    
    const visitor = await prisma.visitor.findFirst({
      where: {
        id: parseInt(visitorId),
        verificationCode: code
      }
    });

    if (!visitor) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Use direct SQL query to set the current date and time in the database's timezone
    // This bypasses any JavaScript Date handling issues
    await prisma.$executeRaw`
      UPDATE visitors 
      SET in_date = CURRENT_DATE, 
          in_time = CURRENT_TIME 
      WHERE id = ${parseInt(visitorId)}
    `;
    
    console.log('Updated visitor check-in with SQL CURRENT_DATE and CURRENT_TIME');

    // Fetch the updated visitor to return in the response
    const updatedVisitor = await prisma.visitor.findUnique({
      where: { id: parseInt(visitorId) }
    });
    
    // Add the current time directly as a formatted string
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Format as 12-hour time
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
    const formattedTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    
    // Add the formatted time to the response
    updatedVisitor.formattedTime = formattedTime;
    
    console.log('Using current time for display:', formattedTime);

    res.json(updatedVisitor);
  } catch (err) {
    console.error('Error in guard verification:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Mark visitor exit
app.put('/api/visitor-exit/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use direct SQL query to set the current date and time in the database's timezone
    // This bypasses any JavaScript Date handling issues
    await prisma.$executeRaw`
      UPDATE visitors 
      SET out_date = CURRENT_DATE, 
          out_time = CURRENT_TIME 
      WHERE id = ${parseInt(id)}
    `;
    
    console.log('Updated visitor exit with SQL CURRENT_DATE and CURRENT_TIME');

    // Fetch the updated visitor to return in the response
    const updatedVisitor = await prisma.visitor.findUnique({
      where: { id: parseInt(id) }
    });
    
    // Add the current time directly as a formatted string
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Format as 12-hour time
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
    const formattedTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    
    // Add the formatted time to the response
    updatedVisitor.formattedOutTime = formattedTime;
    
    console.log('Using current time for display:', formattedTime);

    res.json(updatedVisitor);
  } catch (err) {
    console.error('Error marking visitor exit:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Get all visitors
app.get('/api/visitors', async (req, res) => {
try {
  const visitors = await prisma.visitor.findMany({
    include: {
      resident: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  // Add formatted time for each visitor
  const visitorsWithFormattedTime = visitors.map(visitor => {
    const formattedVisitor = { ...visitor };
    
    // Format inTime if it exists
    if (visitor.inTime) {
      const now = new Date(visitor.inTime);
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Format as 12-hour time
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
      formattedVisitor.formattedTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    
    // Format outTime if it exists
    if (visitor.outTime) {
      const now = new Date(visitor.outTime);
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Format as 12-hour time
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
      formattedVisitor.formattedOutTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    
    return formattedVisitor;
  });
  
  res.json(visitorsWithFormattedTime);
} catch (err) {
  console.error('Error fetching visitors:', err);
  res.status(500).json({ error: err.message });
}
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
