import React, { useState, useEffect, useRef } from 'react';
import { calcularEstadoPago } from './logicaPagos';

function App() {
  const [pagos, setPagos] = useState(() => {
    const datos = localStorage.getItem('pagos_abuelitos');
    return datos ? JSON.parse(datos) : [];
  });

  const [listaPapas, setListaPapas] = useState(() => {
    const datos = localStorage.getItem('lista_papas_abuelitos');
    return datos ? JSON.parse(datos) : [];
  });

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [nuevoPapa, setNuevoPapa] = useState({ nombre: '', nivel: 'Maternal' });
  const [nuevoPago, setNuevoPago] = useState({
    tutor: '', monto: '', tipo: 'Mensual',
    fecha: new Date().toISOString().split('T')[0]
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('pagos_abuelitos', JSON.stringify(pagos));
  }, [pagos]);

  useEffect(() => {
    localStorage.setItem('lista_papas_abuelitos', JSON.stringify(listaPapas));
  }, [listaPapas]);

  const exportarDatos = () => {
    const dataStr = JSON.stringify({ pagos, listaPapas }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `Respaldo_Guarderia.json`);
    linkElement.click();
  };

  const importarDatos = (event) => {
    const fileReader = new FileReader();
    const archivo = event.target.files[0];
    if (!archivo) return;
    fileReader.readAsText(archivo, "UTF-8");
    fileReader.onload = e => {
      try {
        const json = JSON.parse(e.target.result);
        if (json.pagos && json.listaPapas) {
          setPagos(json.pagos); setListaPapas(json.listaPapas);
          alert("¡Datos restaurados!");
        }
      } catch (err) { alert("Error al leer archivo"); }
    };
    event.target.value = null;
  };

  const registrarPapa = (e) => {
    e.preventDefault();
    const nombre = nuevoPapa.nombre.trim();
    if (!nombre || listaPapas.find(p => p.nombre === nombre)) return;
    setListaPapas([...listaPapas, { ...nuevoPapa, nombre }]);
    setNuevoPapa({ nombre: '', nivel: 'Maternal' });
  };

  const eliminarPapaDeLista = (nombre) => {
    if (confirm(`¿Quitar a "${nombre}"?`)) {
      setListaPapas(listaPapas.filter(p => p.nombre !== nombre));
    }
  };

  const manejarEnvioPago = (e) => {
    e.preventDefault();
    const papa = listaPapas.find(p => p.nombre === nuevoPago.tutor);
    if (!papa) return alert("Selecciona un tutor");
    setPagos([{ ...nuevoPago, id: Date.now(), monto: parseFloat(nuevoPago.monto), nivel: papa.nivel }, ...pagos]);
    setNuevoPago({ ...nuevoPago, monto: '' });
  };

  const eliminarRegistroPago = (id) => {
    if (confirm("¿Borrar pago?")) setPagos(pagos.filter(p => p.id !== id));
  };

  const pagosFiltrados = pagos.filter(p => {
    const n = p.tutor.toLowerCase().includes(busqueda.toLowerCase());
    const c = filtroCategoria === 'Todos' || p.nivel === filtroCategoria;
    return n && c;
  });

  const totalIngresos = pagosFiltrados.reduce((acc, p) => acc + p.monto, 0);

  return (
    <div className="main-wrapper">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body { 
          background-color: #F0F4F8; 
          font-family: 'Segoe UI', sans-serif;
          display: flex;
          justify-content: center; /* ESTO CENTRA EN PC */
          min-height: 100vh;
        }
        
        .main-wrapper {
          width: 100%;
          max-width: 1100px; /* Ancho máximo para que no se estire de más */
          padding: 20px;
        }

        .header { text-align: center; margin-bottom: 25px; }
        .header h1 { color: #0277BD; font-size: 2rem; }
        .header p { color: #C62828; font-size: 0.8rem; font-weight: bold; margin-top: 5px; }

        .card { background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: none; }
        
        .summary-card { 
          background: #B3E5FC; 
          color: #0277BD; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: space-between;
          text-align: center;
          gap: 15px;
        }

        @media (min-width: 768px) {
          .summary-card { flex-direction: row; text-align: left; }
        }

        .btn-group { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: 100%; }
        @media (min-width: 768px) { .btn-group { width: auto; } }

        .btn { 
          flex: 1 1 100px; 
          padding: 10px 15px; border-radius: 10px; border: 1.5px solid #0277BD; 
          background: white; color: #0277BD; font-weight: bold; cursor: pointer;
        }
        .btn-pdf { color: #C62828; border-color: #C62828; }

        .grid-layout { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 768px) { .grid-layout { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .grid-layout { grid-template-columns: repeat(3, 1fr); } }

        .input-box { width: 100%; padding: 12px; margin-top: 8px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; }
        .btn-submit { width: 100%; padding: 12px; background: #0277BD; color: white; border: none; border-radius: 10px; font-weight: bold; margin-top: 12px; cursor: pointer; }

        .table-scroll { overflow-x: auto; width: 100%; background: white; border-radius: 15px; }
        table { width: 100%; border-collapse: collapse; min-width: 600px; }
        th { background: #F8FAFC; padding: 15px; font-size: 0.75rem; color: #64748B; text-transform: uppercase; text-align: center; }
        td { padding: 15px; border-bottom: 1px solid #F1F5F9; text-align: center; font-size: 0.95rem; }

        .badge { padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; }
        .badge-maternal { background: #F3E5F5; color: #7B1FA2; }
        .badge-lactantes { background: #E1F5FE; color: #0288D1; }
        .badge-preescolar { background: #FFF3E0; color: #EF6C00; }

        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="container">
        <header className="header">
          <h1>La Casa de mis Abuelitos</h1>
          <p>CONTROL DE PAGOS ESCOLAR</p>
        </header>

        {/* Banner de Ingresos */}
        <div className="card summary-card">
          <div>
            <span style={{fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.8}}>INGRESOS TOTALES</span>
            <h2 style={{fontSize: '2.2rem'}}>${totalIngresos.toLocaleString()}</h2>
          </div>
          <div className="no-print btn-group">
            <button className="btn" onClick={exportarDatos}>💾 Guardar</button>
            <button className="btn" onClick={() => fileInputRef.current.click()}>📂 Abrir</button>
            <input type="file" ref={fileInputRef} onChange={importarDatos} style={{ display: 'none' }} accept=".json" />
            <button className="btn btn-pdf" onClick={() => window.print()}>📄 PDF</button>
          </div>
        </div>

        <div className="no-print grid-layout">
          {/* Tarjeta Alumnos */}
          <div className="card">
            <h3 style={{color: '#0277BD'}}>👤 Alumnos</h3>
            <form onSubmit={registrarPapa}>
              <input placeholder="Nombre del Padre/Madre" value={nuevoPapa.nombre} onChange={(e) => setNuevoPapa({...nuevoPapa, nombre: e.target.value})} className="input-box" required />
              <select value={nuevoPapa.nivel} onChange={(e) => setNuevoPapa({...nuevoPapa, nivel: e.target.value})} className="input-box">
                <option value="Lactantes">Lactantes</option>
                <option value="Maternal">Maternal</option>
                <option value="Preescolar">Preescolar</option>
              </select>
              <button type="submit" className="btn-submit">Añadir al Directorio</button>
            </form>
            <details style={{marginTop: '15px'}}>
              <summary style={{fontSize: '0.85rem', cursor: 'pointer', color: '#555'}}>Ver Directorio ({listaPapas.length})</summary>
              <div style={{maxHeight: '150px', overflowY: 'auto', marginTop: '10px'}}>
                {listaPapas.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map((p, i) => (
                  <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f9f9f9', fontSize:'0.9rem'}}>
                    <span>{p.nombre}</span>
                    <button onClick={()=>eliminarPapaDeLista(p.nombre)} style={{color:'#C62828', border:'none', background:'none', cursor:'pointer'}}>✕</button>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Tarjeta Pagos */}
          <div className="card">
            <h3 style={{color: '#0277BD'}}>💰 Nuevo Pago</h3>
            <form onSubmit={manejarEnvioPago}>
              <select value={nuevoPago.tutor} onChange={(e)=>setNuevoPago({...nuevoPago, tutor: e.target.value})} className="input-box" required>
                <option value="">-- Seleccionar --</option>
                {listaPapas.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map((p,i)=>(
                  <option key={i} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
              <input type="number" placeholder="Importe $" value={nuevoPago.monto} onChange={(e)=>setNuevoPago({...nuevoPago, monto: e.target.value})} className="input-box" required />
              <div style={{display: 'flex', gap: '8px'}}>
                <select value={nuevoPago.tipo} onChange={(e)=>setNuevoPago({...nuevoPago, tipo: e.target.value})} className="input-box">
                  <option value="Semanal">Semanal</option>
                  <option value="Quincenal">Quincenal</option>
                  <option value="Mensual">Mensual</option>
                </select>
                <input type="date" value={nuevoPago.fecha} onChange={(e)=>setNuevoPago({...nuevoPago, fecha: e.target.value})} className="input-box" />
              </div>
              <button type="submit" className="btn-submit" style={{background: '#039BE5'}}>Registrar Pago</button>
            </form>
          </div>

          {/* Tarjeta Filtros */}
          <div className="card">
            <h3 style={{color: '#0277BD'}}>🔍 Historial</h3>
            <input placeholder="Filtrar por nombre..." value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} className="input-box" />
            <select value={filtroCategoria} onChange={(e)=>setFiltroCategoria(e.target.value)} className="input-box">
              <option value="Todos">Todos los niveles</option>
              <option value="Lactantes">Lactantes</option>
              <option value="Maternal">Maternal</option>
              <option value="Preescolar">Preescolar</option>
            </select>
          </div>
        </div>

        {/* Tabla Final */}
        <div className="table-scroll card" style={{padding: '0'}}>
          <table>
            <thead>
              <tr>
                <th style={{textAlign: 'left', paddingLeft: '20px'}}>Alumno</th>
                <th>Nivel</th>
                <th>Monto</th>
                <th>Estado Actual</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map(p => {
                const est = calcularEstadoPago(p.fecha, p.tipo);
                const venc = est.includes("Vencido");
                return (
                  <tr key={p.id} style={{background: venc ? '#FFF8F8' : 'transparent'}}>
                    <td style={{textAlign: 'left', paddingLeft: '20px', fontWeight: 'bold'}}>{p.tutor}</td>
                    <td><span className={`badge badge-${p.nivel?.toLowerCase()}`}>{p.nivel}</span></td>
                    <td style={{fontWeight: 'bold', color: '#0277BD'}}>${p.monto.toLocaleString()}</td>
                    <td style={{color: venc ? '#C62828' : '#2E7D32', fontWeight: 'bold'}}>{est}</td>
                    <td className="no-print">
                      <button onClick={()=>eliminarRegistroPago(p.id)} style={{border:'none', background:'none', color:'#ccc', cursor:'pointer', fontSize: '1.2rem'}}>🗑️</button>
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