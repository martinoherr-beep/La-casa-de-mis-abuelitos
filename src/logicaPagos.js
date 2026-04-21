import { differenceInDays, startOfDay, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

export const calcularEstadoPago = (fechaUltimoPago, tipoPeriodo) => {
  if (!fechaUltimoPago) return "Sin registros";

  // IMPORTANTE: 'hoy' es la fecha real del sistema
  const hoy = startOfDay(new Date());
  
  // 'fechaPago' es la fecha que TÚ elegiste en el calendario (ej: 9 de marzo)
  const [year, month, day] = fechaUltimoPago.split('-');
  const fechaPago = startOfDay(new Date(year, month - 1, day));
  
  // Calculamos cuántos días han pasado desde esa fecha elegida hasta hoy
  const diasTranscurridos = differenceInDays(hoy, fechaPago);

  let limiteDias = 0;
  if (tipoPeriodo === 'Semanal') limiteDias = 7;
  else if (tipoPeriodo === 'Quincenal') limiteDias = 15;
  else if (tipoPeriodo === 'Mensual') limiteDias = 30;

  if (diasTranscurridos >= limiteDias) {
    return `⚠️ Vencido`;
  } else {
    return `✅ Al día`;
  }
};

export const obtenerFechaVencimiento = (fechaUltimoPago, tipoPeriodo) => {
  if (!fechaUltimoPago) return "-";
  
  let diasAAgregar = 0;
  if (tipoPeriodo === 'Semanal') diasAAgregar = 7;
  else if (tipoPeriodo === 'Quincenal') diasAAgregar = 15;
  else if (tipoPeriodo === 'Mensual') diasAAgregar = 30;

  const [year, month, day] = fechaUltimoPago.split('-');
  const fechaBase = new Date(year, month - 1, day);
  
  const fechaVence = addDays(fechaBase, diasAAgregar);
  return format(fechaVence, "d 'de' MMM", { locale: es });
};