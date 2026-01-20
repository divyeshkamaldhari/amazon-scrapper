import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';

export default function JobCard({ job }) {
  const progress = job.totalUpcs > 0
    ? Math.round((job.processed / job.totalUpcs) * 100)
    : 0;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 truncate max-w-xs">
            {job.jobId}
          </h3>
          <p className="text-sm text-gray-500">
            Created: {formatDate(job.createdAt)}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total UPCs:</span>
          <span className="font-medium">{job.totalUpcs.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Processed:</span>
          <span className="font-medium">{job.processed.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Failed:</span>
          <span className="font-medium text-red-600">{job.failed.toLocaleString()}</span>
        </div>

        <ProgressBar progress={progress} />

        <div className="pt-4 flex justify-end">
          <Link
            to={`/jobs/${job.jobId}`}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}
