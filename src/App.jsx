import React, { useState, useEffect } from 'react';
// Importamos la lógica de fechas
import { calcularEstadoPago, obtenerFechaVencimiento } from './logicaPagos';
// IMPORTACIONES DE FIREBASE
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

function App() {
  const [pagos, setPagos] = useState([]);
  const [listaPapas, setListaPapas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [nuevoPapa, setNuevoPapa] = useState({ nombre: '', nivel: 'Maternal' });
  const [nuevoPago, setNuevoPago] = useState({
    tutor: '', monto: '', tipo: 'Mensual',
    fecha: new Date().toISOString().split('T')[0]
  });

  // --- ESCUCHAR DATOS EN TIEMPO REAL DESDE FIREBASE ---
  useEffect(() => {
    // Escuchar Alumnos (Directorio)
    const qAlumnos = query(collection(db, "alumnos"), orderBy("nombre", "asc"));
    const unsubAlumnos = onSnapshot(qAlumnos, (snapshot) => {
      setListaPapas(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    // Escuchar Pagos (Historial)
    const qPagos = query(collection(db, "pagos"), orderBy("fecha", "desc"));
    const unsubPagos = onSnapshot(qPagos, (snapshot) => {
      setPagos(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    return () => { unsubAlumnos(); unsubPagos(); };
  }, []);

  // --- FUNCIONES PARA ESCRIBIR EN LA BASE DE DATOS ---
  const registrarPapa = async (e) => {
    e.preventDefault();
    const nombre = nuevoPapa.nombre.trim();
    if (!nombre) return;
    try {
      await addDoc(collection(db, "alumnos"), { nombre, nivel: nuevoPapa.nivel });
      setNuevoPapa({ nombre: '', nivel: 'Maternal' });
    } catch (err) { alert("Error al guardar en la nube"); }
  };

  const manejarEnvioPago = async (e) => {
    e.preventDefault();
    const papa = listaPapas.find(p => p.nombre === nuevoPago.tutor);
    if (!papa) return alert("Selecciona un tutor");
    try {
      await addDoc(collection(db, "pagos"), {
        ...nuevoPago,
        monto: parseFloat(nuevoPago.monto),
        nivel: papa.nivel
      });
      setNuevoPago({ ...nuevoPago, monto: '' });
    } catch (err) { alert("Error al registrar pago"); }
  };

  const eliminarRegistroPago = async (id) => {
    if (confirm("¿Borrar pago permanentemente de la base de datos?")) {
      await deleteDoc(doc(db, "pagos", id));
    }
  };

  // --- LÓGICA DE FILTROS Y CÁLCULOS ---
  const pagosFiltrados = pagos.filter(p => {
    const n = p.tutor.toLowerCase().includes(busqueda.toLowerCase());
    const c = filtroCategoria === 'Todos' || p.nivel === filtroCategoria;
    return n && c;
  });

  const totalIngresos = pagosFiltrados.reduce((acc, p) => acc + p.monto, 0);
  const totalPorTipo = (tipo) => pagosFiltrados.filter(p => p.tipo === tipo).reduce((acc, p) => acc + p.monto, 0);

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "-";
    const [year, month, day] = fechaStr.split('-');
    const fechaLocal = new Date(year, month - 1, day);
    return fechaLocal.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="layout-root">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #F0F4F8; font-family: 'Segoe UI', sans-serif; min-height: 100vh; }
        .layout-root { display: flex; justify-content: center; width: 100vw; min-height: 100vh; }
        .main-wrapper { width: 100%; max-width: 1100px; padding: 15px; display: flex; flex-direction: column; }
        .header { text-align: center; margin-bottom: 25px; }
        .header h1 { color: #ce1414; font-size: clamp(1.5rem, 5vw, 2.2rem); }
        .card { background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .summary-card { background: #B3E5FC; color: #0277BD; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 15px; }
        .income-details { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 10px; }
        .type-pill { background: rgba(255, 255, 255, 0.4); padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; color: #01579B; }
        @media (min-width: 768px) { .summary-card { flex-direction: row; text-align: left; } .income-details { justify-content: flex-start; } }
        .btn-group { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; width: 100%; }
        .btn { padding: 10px 20px; border-radius: 10px; border: 1.5px solid #0277BD; background: white; color: #0277BD; font-weight: bold; cursor: pointer; font-size: 14px; min-width: 110px; flex: 1 1 auto; }
        .btn-pdf { color: #C62828; border-color: #C62828; width: 100%; }
        .grid-layout { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 768px) { .grid-layout { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .grid-layout { grid-template-columns: repeat(3, 1fr); } }
        .input-box { width: 100%; padding: 12px; margin-top: 8px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; }
        .btn-submit { width: 100%; padding: 14px; background: #0277BD; color: white; border: none; border-radius: 10px; font-weight: bold; margin-top: 12px; cursor: pointer; }
        .table-scroll { overflow-x: auto; width: 100%; background: white; border-radius: 15px; }
        table { width: 100%; border-collapse: collapse; min-width: 850px; }
        th { background: #F8FAFC; padding: 15px; font-size: 0.75rem; color: #64748B; text-transform: uppercase; text-align: center; }
        td { padding: 15px; border-bottom: 1px solid #F1F5F9; text-align: center; font-size: 0.95rem; }
        .badge { padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; }
        .badge-maternal { background: #F3E5F5; color: #7B1FA2; }
        .badge-lactantes { background: #E1F5FE; color: #0288D1; }
        .badge-preescolar { background: #FFF3E0; color: #EF6C00; }
        .type-tag { font-size: 0.75rem; color: #64748B; background: #F1F5F9; padding: 3px 8px; border-radius: 6px; }
        .fecha-pago { display: block; font-size: 0.7rem; opacity: 0.6; margin-top: 4px; font-weight: normal; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="main-wrapper">
        <header className="header">
          <h1>La Casa de mis Abuelitos</h1>
          <p>CONTROL DE PAGOS ESCOLAR</p>
        </header>

        {/* Banner de Ingresos */}
        <div className="card summary-card">
          <div>
            <span style={{fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.8}}>INGRESOS TOTALES</span>
            <h2 style={{fontSize: '2.2rem'}}>${totalIngresos.toLocaleString()}</h2>
            <div className="income-details">
              <div className="type-pill">Semanal: ${totalPorTipo('Semanal').toLocaleString()}</div>
              <div className="type-pill">Quincenal: ${totalPorTipo('Quincenal').toLocaleString()}</div>
              <div className="type-pill">Mensual: ${totalPorTipo('Mensual').toLocaleString()}</div>
            </div>
          </div>
          <div className="no-print" style={{width: '100%', maxWidth: '200px'}}>
            <button className="btn btn-pdf" onClick={() => window.print()}>📄 PDF</button>
          </div>
        </div>

        <div className="no-print grid-layout">
          <div className="card">
            <h3 style={{color: '#0277BD'}}>👤 Alumno</h3>
            <form onSubmit={registrarPapa}>
              <input placeholder="Nombre Completo" value={nuevoPapa.nombre} onChange={(e) => setNuevoPapa({...nuevoPapa, nombre: e.target.value})} className="input-box" required />
              <select value={nuevoPapa.nivel} onChange={(e) => setNuevoPapa({...nuevoPapa, nivel: e.target.value})} className="input-box">
                <option value="Lactantes">Lactantes</option>
                <option value="Maternal">Maternal</option>
                <option value="Preescolar">Preescolar</option>
              </select>
              <button type="submit" className="btn-submit">Dar de Alta</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{color: '#0277BD'}}>💰 Nuevo Pago</h3>
            <form onSubmit={manejarEnvioPago}>
              <select value={nuevoPago.tutor} onChange={(e)=>setNuevoPago({...nuevoPago, tutor: e.target.value})} className="input-box" required>
                <option value="">-- Seleccionar --</option>
                {listaPapas.map((p,i)=>(
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
              <input type="number" placeholder="Monto $" value={nuevoPago.monto} onChange={(e)=>setNuevoPago({...nuevoPago, monto: e.target.value})} className="input-box" required />
              <div style={{display: 'flex', gap: '8px'}}>
                <select value={nuevoPago.tipo} onChange={(e)=>setNuevoPago({...nuevoPago, tipo: e.target.value})} className="input-box">
                  <option value="Semanal">Semanal</option>
                  <option value="Quincenal">Quincenal</option>
                  <option value="Mensual">Mensual</option>
                </select>
                <input type="date" value={nuevoPago.fecha} onChange={(e)=>setNuevoPago({...nuevoPago, fecha: e.target.value})} className="input-box" />
              </div>
              <button type="submit" className="btn-submit" style={{background: '#039BE5'}}>Guardar Pago</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{color: '#0277BD'}}>🔍 Historial</h3>
            <input placeholder="Buscar por nombre..." value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} className="input-box" />
            <select value={filtroCategoria} onChange={(e)=>setFiltroCategoria(e.target.value)} className="input-box">
              <option value="Todos">Todos los niveles</option>
              <option value="Lactantes">Lactantes</option>
              <option value="Maternal">Maternal</option>
              <option value="Preescolar">Preescolar</option>
            </select>
          </div>
        </div>

        <div className="table-scroll card" style={{padding: '0'}}>
          <table>
            <thead>
              <tr>
                <th style={{textAlign: 'left', paddingLeft: '20px'}}>Alumno</th>
                <th>Nivel</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Próximo Pago</th>
                <th>Estado Actual</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map(p => {
                const est = calcularEstadoPago(p.fecha, p.tipo);
                const venc = est.includes("⚠️");
                const proximo = obtenerFechaVencimiento(p.fecha, p.tipo);
                return (
                  <tr key={p.id} style={{background: venc ? '#FFF8F8' : 'transparent'}}>
                    <td style={{textAlign: 'left', paddingLeft: '20px', fontWeight: 'bold'}}>{p.tutor}</td>
                    <td><span className={`badge badge-${p.nivel?.toLowerCase()}`}>{p.nivel}</span></td>
                    <td><span className="type-tag">{p.tipo}</span></td>
                    <td style={{fontWeight: 'bold', color: '#0277BD'}}>${p.monto.toLocaleString()}</td>
                    <td style={{color: '#546E7A', fontWeight: '600', fontSize: '0.85rem'}}>
                      {proximo}
                    </td>
                    <td style={{color: venc ? '#C62828' : '#2E7D32', fontWeight: 'bold'}}>
                      {est}
                      <span className="fecha-pago">Último: {formatearFecha(p.fecha)}</span>
                    </td>
                    <td className="no-print">
                      <button onClick={()=>eliminarRegistroPago(p.id)} style={{border:'none', background:'none', color:'#ccc', cursor:'pointer'}}>🗑️</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;