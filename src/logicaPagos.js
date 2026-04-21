import { differenceInDays, startOfDay } from 'date-fns';

export const calcularEstadoPago = (fechaPago, tipo) => {
  if (tipo !== 'Mensual') return "Al día";

  const hoy = startOfDay(new Date());
  const inicio = startOfDay(new Date(fechaPago));
  
  // Calculamos cuántos días han pasado
  const diasTranscurridos = differenceInDays(hoy, inicio);
  
  // Determinamos la semana (1 a 4)
  const semana = Math.floor(diasTranscurridos / 7) + 1;

  if (semana > 4) return "⚠️ Vencido (Pagar)";
  return `Semana ${semana} de 4`;
};
