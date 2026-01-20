import { useNavigate } from 'react-router-dom';
import { useFileUpload } from '../hooks/useJobs';
import FileUpload from '../components/FileUpload';

export default function Upload() {
  const navigate = useNavigate();
  const { uploadFile, uploading, error, result } = useFileUpload();

  const handleUpload = async (file) => {
    try {
      const response = await uploadFile(file);
      if (response.success && response.data.jobId) {
        navigate(`/jobs/${response.data.jobId}`);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Excel File</h1>

      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            File Requirements
          </h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>File format: Excel (.xlsx)</li>
            <li>Required columns: UPC, Brand</li>
            <li>Maximum file size: 50MB</li>
          </ul>
        </div>

        <FileUpload
          onUpload={handleUpload}
          uploading={uploading}
          error={error}
        />

        {result && result.success && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-lg font-medium text-green-800">
              Job Created Successfully!
            </h3>
            <p className="mt-2 text-green-600">
              Job ID: {result.data.jobId}
            </p>
            <p className="text-green-600">
              Total UPCs: {result.data.totalUpcs}
            </p>
            {result.data.stats && (
              <p className="text-green-600">
                Valid rows: {result.data.stats.validRows} / {result.data.stats.totalRows}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
