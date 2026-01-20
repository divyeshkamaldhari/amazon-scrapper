import { useParams, Link } from 'react-router-dom';
import { useJob } from '../hooks/useJobs';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';

export default function JobProgress() {
  const { id } = useParams();
  const { job, loading, error, refetch, pauseJob, resumeJob, downloadCsv } = useJob(id, 5000);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-800">Error loading job</h3>
        <p className="mt-2 text-red-600">{error}</p>
        <div className="mt-4 flex space-x-4">
          <button
            onClick={refetch}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
          <Link to="/" className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Job not found</h3>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const progress = job.progress || 0;
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{job.jobId}</h1>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Progress Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Progress</h2>
          <ProgressBar progress={progress} />
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{job.totalUpcs.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total UPCs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{job.processed.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Processed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{job.failed.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Failed</p>
            </div>
          </div>
        </div>

        {/* Timestamps Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Timeline</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="font-medium">{formatDate(job.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Started:</span>
              <span className="font-medium">{formatDate(job.startedAt)}</span>
            </div>
            {job.pausedAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Paused:</span>
                <span className="font-medium">{formatDate(job.pausedAt)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Completed:</span>
              <span className="font-medium">{formatDate(job.completedAt)}</span>
            </div>
          </div>
        </div>

        {/* UPC Stats Card */}
        {job.upcStats && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">UPC Statistics</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Pending:</span>
                <span className="font-medium">{job.upcStats.pending.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">In Progress:</span>
                <span className="font-medium">{job.upcStats.inProgress.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Done:</span>
                <span className="font-medium text-green-600">{job.upcStats.done.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Not Found:</span>
                <span className="font-medium text-yellow-600">{job.upcStats.notFound.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Failed:</span>
                <span className="font-medium text-red-600">{job.upcStats.failed.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Result Stats Card */}
        {job.resultStats && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Result Statistics</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Results:</span>
                <span className="font-medium">{job.resultStats.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">With Matches:</span>
                <span className="font-medium text-green-600">{job.resultStats.withMatches.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Brand Matches:</span>
                <span className="font-medium">{job.resultStats.brandMatches.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">UPC Matches:</span>
                <span className="font-medium">{job.resultStats.upcMatches.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {job.errorMessage && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800">Error</h3>
          <p className="mt-2 text-red-600">{job.errorMessage}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex space-x-4">
        {job.status === 'RUNNING' && (
          <button
            onClick={pauseJob}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Pause Job
          </button>
        )}
        {(job.status === 'PAUSED' || job.status === 'QUEUED') && (
          <button
            onClick={resumeJob}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {job.status === 'QUEUED' ? 'Start Job' : 'Resume Job'}
          </button>
        )}
        {job.status === 'COMPLETED' && (
          <button
            onClick={downloadCsv}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Download CSV
          </button>
        )}
        <button
          onClick={refetch}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
