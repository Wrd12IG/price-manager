import { useState, useEffect } from 'react';
import {
    Box,
    LinearProgress,
    Typography,
    Paper,
    Chip,
    IconButton,
    Collapse,
    Stack,
    Alert
} from '@mui/material';
import {
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Pending as PendingIcon,
    Refresh as RefreshIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import api from '../utils/api';

interface Job {
    id: string;
    type: 'import' | 'export' | 'enrichment' | 'merge';
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    message: string;
    startedAt: string;
    completedAt?: string;
    error?: string;
}

const typeLabels: Record<string, string> = {
    import: '📥 Import',
    export: '📤 Export',
    enrichment: '🤖 Arricchimento AI',
    merge: '🔄 Merge'
};

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
    pending: 'warning',
    running: 'primary',
    completed: 'success',
    failed: 'error'
};

interface JobProgressProps {
    jobId?: string;
    showAll?: boolean;
    onComplete?: () => void;
}

export default function JobProgress({ jobId, showAll = false, onComplete }: JobProgressProps) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);

    const fetchJobs = async () => {
        try {
            const endpoint = showAll ? '/jobs' : '/jobs/active';
            const res = await api.get(endpoint);
            setJobs(res.data.data);
        } catch (e) {
            console.error('Error fetching jobs:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchSingleJob = async () => {
        if (!jobId) return;
        try {
            const res = await api.get(`/jobs/${jobId}`);
            setJobs([res.data.data]);

            if (res.data.data.status === 'completed' || res.data.data.status === 'failed') {
                onComplete?.();
            }
        } catch (e) {
            console.error('Error fetching job:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (jobId) {
            fetchSingleJob();
            // Polling ogni 2 secondi per singolo job
            const interval = setInterval(fetchSingleJob, 2000);
            return () => clearInterval(interval);
        } else {
            fetchJobs();
            // Polling ogni 5 secondi per lista
            const interval = setInterval(fetchJobs, 5000);
            return () => clearInterval(interval);
        }
    }, [jobId, showAll]);

    if (loading || (jobs.length === 0 && !showAll)) {
        return null;
    }

    const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending');

    if (activeJobs.length === 0 && !showAll) {
        return null;
    }

    return (
        <Paper
            elevation={3}
            sx={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                width: 380,
                zIndex: 1300,
                overflow: 'hidden',
                borderRadius: 2
            }}
        >
            <Box
                sx={{
                    bgcolor: '#000',
                    color: 'white',
                    px: 2,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <Typography variant="subtitle2" fontWeight="bold">
                    🚀 Operazioni in Corso ({activeJobs.length})
                </Typography>
                <Box>
                    <IconButton size="small" sx={{ color: 'white' }} onClick={(e) => { e.stopPropagation(); fetchJobs(); }}>
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" sx={{ color: 'white' }}>
                        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                </Box>
            </Box>

            <Collapse in={expanded}>
                <Box sx={{ maxHeight: 300, overflowY: 'auto', p: 2 }}>
                    {jobs.length === 0 ? (
                        <Typography color="textSecondary" textAlign="center" py={2}>
                            Nessuna operazione in corso
                        </Typography>
                    ) : (
                        <Stack spacing={2}>
                            {jobs.map((job) => (
                                <Box key={job.id} sx={{ p: 1.5, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                        <Typography variant="body2" fontWeight="bold">
                                            {typeLabels[job.type] || job.type}
                                        </Typography>
                                        <Chip
                                            size="small"
                                            label={job.status}
                                            color={statusColors[job.status]}
                                            icon={
                                                job.status === 'completed' ? <CheckIcon /> :
                                                    job.status === 'failed' ? <ErrorIcon /> :
                                                        job.status === 'running' ? undefined :
                                                            <PendingIcon />
                                            }
                                        />
                                    </Box>

                                    {(job.status === 'running' || job.status === 'pending') && (
                                        <Box mb={1}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={job.progress}
                                                sx={{
                                                    height: 8,
                                                    borderRadius: 4,
                                                    bgcolor: '#e0e0e0',
                                                    '& .MuiLinearProgress-bar': {
                                                        bgcolor: '#667eea'
                                                    }
                                                }}
                                            />
                                            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                                                {job.progress}%
                                            </Typography>
                                        </Box>
                                    )}

                                    <Typography variant="caption" color="textSecondary">
                                        {job.message}
                                    </Typography>

                                    {job.status === 'failed' && job.error && (
                                        <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: '0.75rem' }}>
                                            {job.error}
                                        </Alert>
                                    )}
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Box>
            </Collapse>
        </Paper>
    );
}
