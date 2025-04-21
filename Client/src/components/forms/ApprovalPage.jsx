import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { visitorService } from '../../services/api';

export default function ApprovalPage({ action = 'approve' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [visitor, setVisitor] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const updateVisitorStatus = async () => {
      try {
        const status = action === 'approve' ? 'approved' : 'rejected';
        const response = await visitorService.updateStatus(id, status);
        setVisitor(response);
        toast.success(
          action === 'approve'
            ? 'Visitor request approved successfully!'
            : 'Visitor request rejected successfully!'
        );
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } catch (error) {
        const errorMessage = action === 'approve'
          ? 'Failed to approve visitor.'
          : 'Failed to reject visitor.';
        setError(errorMessage);
        toast.error(errorMessage + ' Please try again.');
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      updateVisitorStatus();
    }
  }, [id, navigate, action]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing approval...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="text-center">
          {visitor ? (
            <>
              <svg
                className="mx-auto h-12 w-12 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                {action === 'approve' ? 'Visitor Approved!' : 'Visitor Rejected'}
              </h2>
              <div className="mt-4 text-sm text-gray-600">
                <p>Visitor: {visitor.visitorName}</p>
                <p>Email: {visitor.visitorEmail}</p>
                <p className="mt-2">An email with the verification code has been sent to the visitor.</p>
              </div>
              <p className="mt-4 text-sm text-gray-500">Redirecting to home page...</p>
            </>
          ) : (
            <>
              <svg
                className="mx-auto h-12 w-12 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">Approval Failed</h2>
              <p className="mt-2 text-sm text-gray-600">
                {error || `Unable to process the ${action} request. Please try again or contact support.`}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
