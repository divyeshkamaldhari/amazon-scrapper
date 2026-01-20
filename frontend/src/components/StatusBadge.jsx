const statusConfig = {
  QUEUED: {
    label: 'Queued',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800'
  },
  RUNNING: {
    label: 'Running',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800'
  },
  PAUSED: {
    label: 'Paused',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800'
  },
  COMPLETED: {
    label: 'Completed',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800'
  },
  FAILED: {
    label: 'Failed',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800'
  }
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.QUEUED;

  return (
    <span
      className={`px-3 py-1 text-sm font-medium rounded-full ${config.bgColor} ${config.textColor}`}
    >
      {config.label}
    </span>
  );
}
