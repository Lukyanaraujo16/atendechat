import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import brLocale from 'date-fns/locale/pt-BR';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { Button, Stack, TextField, Paper, Typography, Box } from '@mui/material';
import { useTheme } from '@material-ui/core/styles';
import api from '../../services/api';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { i18n } from '../../translate/i18n';

export const ChartsDate = () => {
  const theme = useTheme();
  const chartColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
  ];
  const gridStroke = theme.palette.divider;
  const axisStroke = theme.palette.text.secondary;
  const paperSx = {
    p: 3,
    borderRadius: 3,
    height: '100%',
    bgcolor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[1],
  };
  const [initialDate, setInitialDate] = useState(new Date());
  const [finalDate, setFinalDate] = useState(new Date());
  const [ticketsData, setTicketsData] = useState({ data: [], count: 0 });
  const [loading, setLoading] = useState(false);

  const companyId = localStorage.getItem('companyId');

  const handleGetTicketsInformation = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/dashboard/ticketsDay?initialDate=${format(initialDate, 'yyyy-MM-dd')}&finalDate=${format(finalDate, 'yyyy-MM-dd')}&companyId=${companyId}`
      );
      setTicketsData(data);
    } catch (error) {
      toast.error(i18n.t('dashboard.toasts.dateChartError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGetTicketsInformation();
  }, []);

  const chartData =
    ticketsData?.data?.length > 0
      ? ticketsData.data.map((item) => ({
          name: item.hasOwnProperty('horario')
            ? `${item.horario}h`
            : item.data,
          total: item.total,
          fullLabel: item.hasOwnProperty('horario')
            ? `Das ${item.horario}:00 às ${item.horario}:59`
            : item.data,
        }))
      : [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const item = chartData.find((d) => d.name === label);
    return (
      <Paper elevation={2} sx={{ p: 1.5, minWidth: 140, bgcolor: theme.palette.background.paper }}>
        <Typography variant="body2" color="textSecondary">
          {item?.fullLabel || label}
        </Typography>
        <Typography variant="h6" color="primary">
          {payload[0].value} {i18n.t('dashboard.charts.date.tickets')}
        </Typography>
      </Paper>
    );
  };

  return (
    <Paper elevation={0} sx={paperSx}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Typography variant="h6" style={{ fontWeight: 600 }} color="text.primary">
          {i18n.t('dashboard.charts.date.title')} ({ticketsData?.count ?? 0})
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
            <DatePicker
              value={initialDate}
              onChange={(newValue) => setInitialDate(newValue)}
              label={i18n.t('dashboard.charts.date.start')}
              renderInput={(params) => <TextField {...params} size="small" sx={{ width: '18ch' }} />}
            />
            <DatePicker
              value={finalDate}
              onChange={(newValue) => setFinalDate(newValue)}
              label={i18n.t('dashboard.charts.date.end')}
              renderInput={(params) => <TextField {...params} size="small" sx={{ width: '18ch' }} />}
            />
          </LocalizationProvider>
          <Button
            variant="contained"
            onClick={handleGetTicketsInformation}
            disabled={loading}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            {i18n.t('dashboard.charts.date.filter')}
          </Button>
        </Stack>
      </Box>
      <Box sx={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisStroke }} stroke={axisStroke} />
            <YAxis tick={{ fontSize: 12, fill: axisStroke }} stroke={axisStroke} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={chartColors[index % chartColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
