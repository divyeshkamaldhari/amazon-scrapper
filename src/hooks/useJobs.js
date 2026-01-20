import { useState, useEffect, useCallback } from 'react';
import { jobApi } from '../services/api';

export function useJobs(refreshInterval = null) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const response = await jobApi.getJobs();
      setJobs(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();

    if (refreshInterval) {
      const interval = setInterval(fetchJobs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchJobs, refreshInterval]);

  return { jobs, loading, error, refetch: fetchJobs };
}

export function useJob(jobId, refreshInterval = null) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;

    try {
      setError(null);
      const response = await jobApi.getJob(jobId);
      setJob(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();

    if (refreshInterval) {
      const interval = setInterval(fetchJob, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchJob, refreshInterval]);

  const pauseJob = async () => {
    try {
      await jobApi.pauseJob(jobId);
      await fetchJob();
    } catch (err) {
      setError(err.message);
    }
  };

  const resumeJob = async () => {
    try {
      await jobApi.resumeJob(jobId);
      await fetchJob();
    } catch (err) {
      setError(err.message);
    }
  };

  const downloadCsv = async () => {
    try {
      await jobApi.downloadCsv(jobId);
    } catch (err) {
      setError(err.message);
    }
  };

  return { job, loading, error, refetch: fetchJob, pauseJob, resumeJob, downloadCsv };
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const uploadFile = async (file) => {
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const response = await jobApi.uploadFile(file);
      setResult(response);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
  };

  return { uploadFile, uploading, error, result, reset };
}
