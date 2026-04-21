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
          background-color: #f0f4f8; 
          font-family: 'Segoe UI', sans-serif;
          display: flex;
          justify-content: center;
        }
        
        .main-wrapper {
          width: 100%;
          max-width: 1000px;
          padding: 15px;
        }

        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { color: #0277bd; font-size: 1.8rem; }
        .header p { color: #c62828; font-size: 0.7rem; font-weight: bold; }

        .card { background: white; border-radius: 15px; padding: 20px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        
        .summary-card { 
          background: #b3e5fc; color: #0277bd; 
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 15px;
        }

        @media (min-width: 768px) {
          .summary-card { flex-direction: row; justify-content: space-between; text-align: left; }
        }

        .btn-group { display: flex; flex-direction: column; gap: 10px; width: 100%; }
        @media (min-width: 768px) { .btn-group { flex-direction: row; width: auto; } }

        .btn { 
          padding: 12px; border-radius: 10px; border: 1.5px solid #0277bd; 
          background: white; color: #0277bd; font-weight: bold; cursor: pointer; width: 100%;
        }
        @media (min-width: 768px) { .btn { width: auto; min-width: 110px; } }
        .btn-pdf { color: #c62828; border-color: #c62828; }

        .grid-layout { display: grid; grid-template-columns: 1fr; gap: 15px; }
        @media (min-width: 768px) { .grid-layout { grid-template-columns: repeat(3, 1fr); } }

        .input-box { width: 100%; padding: 12px; margin-top: 8px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; }
        .btn-submit { width: 100%; padding: 12px; background: #0277bd; color: white; border: none; border-radius: 10px; font-weight: bold; margin-top: 10px; cursor: pointer; }

        .table-scroll { overflow-x: auto; background: white; border-radius: 15px; width: 100%; }
        table { width: 100%; border-collapse: collapse; min-width: 500px; }
        th { background: #f8fafc; padding: 12px; font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-size: 0.85rem; }

        .badge { padding: 3px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: bold; }
        .badge-maternal { background: #f3e5f5; color: #7b1fa2; }
        .badge-lactantes { background: #e1f5fe; color: #0288d1; }
        .badge-preescolar { background: #fff3e0; color: #ef6c00; }

        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="container">
        <header className="header">
          <h1>La Casa de mis Abuelitos</h1>
          <p>ADMINISTRACIÓN GENERAL</p>
        </header>

        <div className="card summary-card">
          <div>
            <span style={{fontSize: '0.75rem', fontWeight: 'bold'}}>INGRESOS TOTALES</span>
            <h2 style={{fontSize: '2rem'}}>${totalIngresos.toLocaleString()}</h2>
          </div>
          <div className="no-print btn-group">
            <button className="btn" onClick={exportarDatos}>💾 Guardar</button>
            <button className="btn" onClick={() => fileInputRef.current.click()}>📂 Abrir</button>
            <input type="file" ref={fileInputRef} onChange={importarDatos} style={{ display: 'none' }} accept=".json" />
            <button className="btn btn-pdf" onClick={() => window.print()}>📄 PDF</button>
          </div>
        </div>

        <div className="no-print grid-layout">
          <div className="card">
            <h3 style={{color: '#0277bd'}}>👤 Alumnos</h3>
            <form onSubmit={registrarPapa}>
              <input placeholder="Nombre" value={nuevoPapa.nombre} onChange={(e) => setNuevoPapa({...nuevoPapa, nombre: e.target.value})} className="input-box" required />
              <select value={nuevoPapa.nivel} onChange={(e) => setNuevoPapa({...nuevoPapa, nivel: e.target.value})} className="input-box">
                <option value="Lactantes">Lactantes</option>
                <option value="Maternal">Maternal</option>
                <option value="Preescolar">Preescolar</option>
              </select>
              <button type="submit" className="btn-submit">Dar de Alta</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{color: '#0277bd'}}>💰 Pago</h3>
            <form onSubmit={manejarEnvioPago}>
              <select value={nuevoPago.tutor} onChange={(e)=>setNuevoPago({...nuevoPago, tutor: e.target.value})} className="input-box" required>
                <option value="">-- Quién? --</option>
                {listaPapas.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map((p,i)=>(
                  <option key={i} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
              <input type="number" placeholder="Monto $" value={nuevoPago.monto} onChange={(e)=>setNuevoPago({...nuevoPago, monto: e.target.value})} className="input-box" required />
              <div style={{display: 'flex', gap: '5px'}}>
                <select value={nuevoPago.tipo} onChange={(e)=>setNuevoPago({...nuevoPago, tipo: e.target.value})} className="input-box">
                  <option value="Semanal">Semanal</option>
                  <option value="Quincenal">Quincenal</option>
                  <option value="Mensual">Mensual</option>
                </select>
                <input type="date" value={nuevoPago.fecha} onChange={(e)=>setNuevoPago({...nuevoPago, fecha: e.target.value})} className="input-box" />
              </div>
              <button type="submit" className="btn-submit" style={{background: '#039be5'}}>Guardar</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{color: '#0277bd'}}>🔍 Filtros</h3>
            <input placeholder="Buscar nombre..." value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} className="input-box" />
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
                <th style={{textAlign: 'left', paddingLeft: '15px'}}>Padre</th>
                <th>Nivel</th>
                <th>Monto</th>
                <th>Estado</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map(p => {
                const est = calcularEstadoPago(p.fecha, p.tipo);
                const venc = est.includes("Vencido");
                return (
                  <tr key={p.id} style={{background: venc ? '#fff5f5' : 'transparent'}}>
                    <td style={{textAlign: 'left', paddingLeft: '15px', fontWeight: 'bold'}}>{p.tutor}</td>
                    <td><span className={`badge badge-${p.nivel?.toLowerCase()}`}>{p.nivel}</span></td>
                    <td style={{fontWeight: 'bold', color: '#0277bd'}}>${p.monto}</td>
                    <td style={{color: venc ? 'red' : 'green', fontWeight: 'bold', fontSize: '11px'}}>{est}</td>
                    <td className="no-print">
                      <button onClick={()=>eliminarRegistroPago(p.id)} style={{border:'none', background:'none', color:'#ddd'}}>🗑️</button>
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