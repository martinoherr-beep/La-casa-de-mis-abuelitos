import React, { useState, useEffect } from 'react';
import { calcularEstadoPago, obtenerFechaVencimiento } from './logicaPagos';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";

function App() {
  const [pagos, setPagos] = useState([]);
  const [listaPapas, setListaPapas] = useState([]);
  const [productosCocina, setProductosCocina] = useState([]);
  const [gastosServicios, setGastosServicios] = useState({ luz: 0, agua: 0 });
  
  // ESTADOS DE INTERFAZ
  const [modoSuper, setModoSuper] = useState(false);
  const [filtroNivelTab, setFiltroNivelTab] = useState(null); // NULL para que inicie vacío
  const [menuSugerido, setMenuSugerido] = useState("");
  const [cargandoIA, setCargandoIA] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  
  const [nuevoPapa, setNuevoPapa] = useState({ nombre: '', nivel: 'Maternal' });
  const [nuevoItemCocina, setNuevoItemCocina] = useState('');
  const [nuevoPago, setNuevoPago] = useState({
    tutor: '', monto: '', tipo: 'Mensual',
    fecha: new Date().toISOString().split('T')[0]
  });

  // --- CARGA DE DATOS ---
  useEffect(() => {
    onSnapshot(doc(db, "configuracion", "servicios"), (snapshot) => {
      if (snapshot.exists()) setGastosServicios(snapshot.data());
    });
    onSnapshot(query(collection(db, "alumnos"), orderBy("nombre", "asc")), (snap) => {
      setListaPapas(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    onSnapshot(query(collection(db, "pagos"), orderBy("fecha", "desc")), (snap) => {
      setPagos(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    onSnapshot(query(collection(db, "cocina"), orderBy("nombre", "asc")), (snap) => {
      setProductosCocina(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });
  }, []);

  // --- FUNCIONES ---
  const toggleComprado = async (id, compradoActual) => {
    await updateDoc(doc(db, "cocina", id), { comprado: !compradoActual });
  };

  const consultarMenuIA = async () => {
    if (productosCocina.length === 0) return alert("Agrega productos al mandado primero.");
    const ingredientes = productosCocina.map(p => p.nombre).join(", ");
    const prompt = `Actúa como nutriólogo de guardería. Tengo estos ingredientes: ${ingredientes}. Sugiere 1 desayuno y 1 comida saludables para niños de 1 a 5 años. Responde breve en español.`;
    const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank");
  };

  const registrarPapa = async (e) => {
    e.preventDefault();
    if (!nuevoPapa.nombre.trim()) return;
    await addDoc(collection(db, "alumnos"), { ...nuevoPapa });
    setNuevoPapa({ nombre: '', nivel: 'Maternal' });
  };

  const manejarEnvioPago = async (e) => {
    e.preventDefault();
    const papa = listaPapas.find(p => p.nombre === nuevoPago.tutor);
    if (!papa) return alert("Selecciona un tutor");
    await addDoc(collection(db, "pagos"), { ...nuevoPago, monto: parseFloat(nuevoPago.monto), nivel: papa.nivel });
    setNuevoPago({ ...nuevoPago, monto: '' });
  };

  const actualizarServicio = async (tipo, valor) => {
    const nuevoValor = parseFloat(valor) || 0;
    await setDoc(doc(db, "configuracion", "servicios"), { ...gastosServicios, [tipo]: nuevoValor });
  };

  const agregarProductoCocina = async (e) => {
    e.preventDefault();
    if (!nuevoItemCocina.trim()) return;
    const idFix = nuevoItemCocina.toLowerCase().trim().replace(/\s/g, '_');
    await setDoc(doc(db, "cocina", idFix), { nombre: nuevoItemCocina, precio: 0, comprado: false });
    setNuevoItemCocina('');
  };

  const actualizarPrecioCocina = async (id, valor) => {
    await updateDoc(doc(db, "cocina", id), { precio: parseFloat(valor) || 0 });
  };

  const eliminarProductoCocina = async (id) => {
    if (confirm("¿Eliminar permanentemente?")) await deleteDoc(doc(db, "cocina", id));
  };

  const resetearCocina = async () => {
    if (confirm("¿Es lunes? Se limpiarán los precios.")) {
      productosCocina.forEach(async (p) => await updateDoc(doc(db, "cocina", p.id), { precio: 0, comprado: false }));
    }
  };

  const eliminarRegistroPago = async (id) => {
    if (confirm("¿Borrar registro de pago?")) await deleteDoc(doc(db, "pagos", id));
  };

  // --- CÁLCULOS ---
  const totalIngresos = pagos.reduce((acc, p) => acc + p.monto, 0);
  const totalGastosCocina = productosCocina.reduce((acc, p) => acc + (p.precio || 0), 0);
  const totalServicios = (gastosServicios.luz || 0) + (gastosServicios.agua || 0);
  const balanceReal = totalIngresos - totalGastosCocina - totalServicios;
  const totalPorTipo = (tipo) => pagos.filter(p => p.tipo === tipo).reduce((acc, p) => acc + p.monto, 0);
  
  // --- LÓGICA DE FILTRADO ---
  const pagosTabla = filtroNivelTab === 'DEUDORES'
  ? pagos.filter(p => {
      const esUltimoPago = !pagos.some(otro => 
        otro.tutor === p.tutor && 
        new Date(otro.fecha) > new Date(p.fecha)
      );
      const estado = calcularEstadoPago(p.fecha, p.tipo);
      return esUltimoPago && estado.includes('⚠️') && p.tutor.toLowerCase().includes(busqueda.toLowerCase());
    })
  : filtroNivelTab === 'HISTORIAL'
    ? pagos.filter(p => p.tutor.toLowerCase().includes(busqueda.toLowerCase())) 
    : filtroNivelTab 
      ? pagos.filter(p => {
          const esUltimoPago = !pagos.some(otro => 
            otro.tutor === p.tutor && 
            new Date(otro.fecha) > new Date(p.fecha)
          );
          const estado = calcularEstadoPago(p.fecha, p.tipo);
          const estaAlDia = !estado.includes('⚠️');
          const coincideNivel = p.nivel === filtroNivelTab;
          const coincideNombre = p.tutor.toLowerCase().includes(busqueda.toLowerCase());

          return esUltimoPago && estaAlDia && coincideNivel && coincideNombre;
        })
      : [];

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "-";
    const [year, month, day] = fechaStr.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="layout-root">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #F0F4F8; font-family: 'Segoe UI', sans-serif; min-height: 100vh; }
        .layout-root { display: flex; justify-content: center; width: 100vw; min-height: 100vh; }
        .main-wrapper { width: 100%; max-width: 1200px; padding: 15px; display: flex; flex-direction: column; }
        .header { 
  display: flex; 
  align-items: center; 
  justify-content: center; /* Mantiene el bloque centrado en la pantalla */
  gap: 15px; 
  margin-bottom: 25px; 
}
  .header { 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  gap: 20px; 
  margin-bottom: 25px;
  flex-wrap: wrap; /* Para que en celulares muy pequeños no se amontone */
}
        .header h1 { color: #f31c1c; font-size: 2.2rem; font-weight: 900; margin: 0; }
        .header-logo {
  width: 90px; /* Tamaño controlado, puedes bajarlo a 100px si lo prefieres */
  height: 120px;
  object-fit: contain; /* Evita que la imagen se deforme */
  border-radius: 50%; /* Mantiene la forma circular perfecta */
}
  .header-text-container {
  text-align: left; /* El texto se alinea a la izquierda respecto al logo */
}
  .header-text-container h1 {
  margin: 0;
  line-height: 1.2;
}
        .card { background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .summary-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 20px; }
        @media (min-width: 768px) { .summary-grid { grid-template-columns: 1.5fr 1fr; } }
        .summary-card { background: #ffffff; color: #0277BD; padding: 25px; position: relative; }
        .balance-card { background: #d7e2f5; color: #565656; border: 2px solid #a0bafa; text-align: center; display: flex; flex-direction: column; justify-content: center; }
        .type-pill { padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; margin-right: 8px; color: white; display: inline-block; }
        .pill-semanal { background-color: #7B1FA2; }
        .pill-quincenal { background-color: #0288D1; }
        .pill-mensual { background-color: #EF6C00; }
        .grid-layout { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px; }
        @media (min-width: 768px) { .grid-layout { grid-template-columns: repeat(3, 1fr); } }
        .input-box { width: 100%; padding: 12px; margin-top: 8px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; background: #fdfdfd; color: #000; }
        .btn-submit { width: 100%; padding: 14px; background: #0277BD; color: white; border: none; border-radius: 10px; font-weight: bold; margin-top: 12px; cursor: pointer; }
        .notebook { background: white; border-radius: 8px; box-shadow: 3px 3px 10px rgba(0,0,0,0.1); padding: 30px 15px 15px 45px; position: relative; background-image: linear-gradient(#e5e5e5 1px, transparent 1px); background-size: 100% 28px; line-height: 28px; height: 420px; display: flex; flex-direction: column; font-family: 'Courier New', Courier, monospace; color: #000; }
        .notebook::before { content: ''; position: absolute; top: 0; left: 35px; width: 2px; height: 100%; background: #ffadad; }
        .notebook-content { flex: 1; overflow-y: auto; padding-right: 5px; }
        .product-row { display: flex; justify-content: space-between; align-items: center; height: 28px; color: #000; }
        .product-left { display: flex; align-items: center; }
        .product-name { color: #000080; font-weight: bold; margin-left: 5px; }
        .btn-delete-item { background: #ffeded; border: none; color: #ffadad; cursor: pointer; font-size: 0.6rem; width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0.5; transition: all 0.2s; }
        .btn-delete-item:hover { opacity: 1; background: #ffadad; color: white; }
        .notebook-add-input { border: none; border-bottom: 2px solid #ce1414; background: rgba(255, 255, 255, 0.8); width: 100%; padding: 10px; font-family: inherit; font-size: 1rem; font-weight: bold; outline: none; margin-bottom: 15px; color: #000 !important; }
        .notebook-input { border: none; border-bottom: 1px dashed #999; width: 70px; text-align: right; background: transparent; font-family: inherit; font-weight: bold; color: #ce1414 !important; outline: none; }
        .badge { padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; }
        .badge-maternal { background: #F3E5F5; color: #7B1FA2; }
        .badge-lactantes { background: #E1F5FE; color: #0288D1; }
        .badge-preescolar { background: #FFF3E0; color: #EF6C00; }
        .table-scroll { overflow-x: auto; background: white; border-radius: 15px; }
        table { width: 100%; border-collapse: collapse; min-width: 850px; }
        th { background: #F8FAFC; padding: 15px; font-size: 0.7rem; color: #64748B; text-transform: uppercase; }
        td { padding: 15px; border-bottom: 1px solid #F1F5F9; text-align: center; color: #333; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="main-wrapper">
     <header className="header">
  {/* Logo a la izquierda */}
  <img 
    src="https://res.cloudinary.com/dvikeqkst/image/upload/v1776960704/logo_casa_wxquvl.png" 
    alt="Logo La Casa de mis Abuelitos" 
    className="header-logo no-print" 
  />

  <div className="header-text-container">
    <h1>La Casa de mis Abuelitos</h1>
    <p style={{ letterSpacing: '1px', fontSize: '0.85rem', color: '#64748B', margin: 0 }}>
      GESTIÓN ADMINISTRATIVA
    </p>
  </div>
</header>

        <div className="summary-grid">
          <div className="card summary-card">
            <span style={{fontSize:'0.7rem', fontWeight:'900'}}>INGRESOS TOTALES</span>
            <h2 style={{fontSize: '2.5rem', margin:'5px 0'}}>${totalIngresos.toLocaleString()}</h2>
            <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
               <span className="type-pill pill-semanal">Sem: ${totalPorTipo('Semanal').toLocaleString()}</span>
               <span className="type-pill pill-quincenal">Quin: ${totalPorTipo('Quincenal').toLocaleString()}</span>
               <span className="type-pill pill-mensual">Men: ${totalPorTipo('Mensual').toLocaleString()}</span>
            </div>
            <button className="no-print" onClick={() => window.print()} style={{position:'absolute', top:'20px', right:'20px', background:'white', border:'1px solid #0277BD', color:'#0277BD', padding:'5px', borderRadius:'5px', cursor:'pointer'}}>📄 PDF</button>
          </div>
          <div className="card balance-card">
            <span style={{fontSize:'0.7rem', fontWeight:'900'}}>CAJA REAL (NETO)</span>
            <h2 style={{fontSize: '2.5rem', margin:'5px 0'}}>${balanceReal.toLocaleString()}</h2>
            <div style={{fontSize:'0.65rem', color:'#555'}}>
              Súper: -${totalGastosCocina.toLocaleString()} | Servicios: -${totalServicios.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="no-print grid-layout">
          <div className="card" style={{background:'#FFF9C4', border:'1px solid #FBC02D'}}>
            <h3 style={{color:'#F57F17', fontSize:'1.1rem', marginBottom:'10px'}}>🔌 Servicios</h3>
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'0.7rem', fontWeight:'bold', color: '#0b70c3'}}>Luz (Capa):</label>
              <input type="number" className="input-box" value={gastosServicios.luz} onChange={(e) => actualizarServicio('luz', e.target.value)} />
            </div>
            <div>
              <label style={{fontSize:'0.7rem', fontWeight:'bold', color: '#0b70c3'}}>Agua:</label>
              <input type="number" className="input-box" value={gastosServicios.agua} onChange={(e) => actualizarServicio('agua', e.target.value)} />
            </div>
          </div>

          <div className="card">
            <h3 style={{color: '#0277BD', fontSize:'1.1rem'}}>👤 Madre/Padre</h3>
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
            <h3 style={{color: '#404040', fontSize:'1.1rem'}}>💰 Pago</h3>
            <form onSubmit={manejarEnvioPago}>
              <select value={nuevoPago.tutor} onChange={(e)=>setNuevoPago({...nuevoPago, tutor: e.target.value})} className="input-box" required>
                <option value="">-- Seleccionar --</option>
                {listaPapas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
              <input type="number" placeholder="Monto $" value={nuevoPago.monto} onChange={(e)=>setNuevoPago({...nuevoPago, monto: e.target.value})} className="input-box" required />
              <select value={nuevoPago.tipo} onChange={(e)=>setNuevoPago({...nuevoPago, tipo: e.target.value})} className="input-box">
                <option value="Semanal">Semanal</option>
                <option value="Quincenal">Quincenal</option>
                <option value="Mensual">Mensual</option>
              </select>
              <input 
                type="date" 
                value={nuevoPago.fecha} 
                onChange={(e)=>setNuevoPago({...nuevoPago, fecha: e.target.value})} 
                className="input-box" 
                style={{ backgroundColor: '#464646', border: '1px solid #313131', color: '#f3f3f3' }}
              />
              <button type="submit" className="btn-submit" style={{background:'#039BE5'}}>Guardar</button>
            </form>
          </div>
        </div>

        <div className="notebook card">
          <h3 style={{color: '#ce1414', fontFamily:'serif', fontSize:'1.2rem', marginBottom: '10px'}}>Lista Mandado</h3>
          <button className="no-print" onClick={() => setModoSuper(true)} style={{backgroundColor: '#FF9800', color: 'white', padding: '8px', borderRadius: '8px', border: 'none', width: '100%', marginBottom: '10px', fontWeight: 'bold', cursor: 'pointer'}}>🛒 MODO SÚPER</button>
          <form onSubmit={agregarProductoCocina} className="no-print">
            <input className="notebook-add-input" placeholder="+ Nuevo producto..." value={nuevoItemCocina} onChange={(e)=>setNuevoItemCocina(e.target.value)} />
          </form>
          <div className="notebook-content">
            {productosCocina.map(p => (
              <div key={p.id} className="product-row" style={{ opacity: p.comprado ? 0.5 : 1 }}>
                <div className="product-left">
                  <button className="btn-delete-item no-print" onClick={() => eliminarProductoCocina(p.id)}>✖</button>
                  <input type="checkbox" checked={p.comprado || false} onChange={() => toggleComprado(p.id, p.comprado)} />
                  <span className="product-name" style={{ textDecoration: p.comprado ? 'line-through' : 'none' }}>• {p.nombre}</span>
                </div>
                <span>$ <input type="number" className="notebook-input" value={p.precio} onChange={(e)=>actualizarPrecioCocina(p.id, e.target.value)} /></span>
              </div>
            ))}
          </div>
          <div style={{marginTop:'10px', textAlign:'right', borderTop:'2px solid #ce1414', paddingTop:'5px'}}>
            <strong>Total: ${totalGastosCocina.toLocaleString()}</strong>
            <button className="no-print" onClick={consultarMenuIA} style={{display: 'block', width: '100%', marginTop: '10px', padding: '10px', borderRadius: '10px', background: 'linear-gradient(45deg, #7B1FA2, #0288D1)', color: 'white', fontWeight: 'bold', cursor: 'pointer', border:'none', fontSize: '0.8rem'}}>✨ SUGERIR MENÚS IA</button>
            <button onClick={resetearCocina} style={{display:'block', width:'100%', marginTop:'5px', fontSize:'0.6rem', color:'#999', cursor:'pointer', background:'none', border:'none'}}>🔄 RESET LUNES</button>
          </div>
        </div>

        <div className="card table-scroll" style={{padding:'0'}}>
          <div style={{padding:'20px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h3 style={{color:'#0277BD'}}>Historial de Pagos</h3>
              <input placeholder="Buscar Madre/Padre..." value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} style={{padding:'8px', borderRadius:'8px', border:'1px solid #ddd'}} />
            </div>
            
            <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
               <span onClick={()=>setFiltroNivelTab('Lactantes')} className="type-pill pill-semanal" style={{cursor:'pointer', opacity: filtroNivelTab==='Lactantes'?1:0.4}}>LACTANTES</span>
               <span onClick={()=>setFiltroNivelTab('Maternal')} className="type-pill pill-quincenal" style={{cursor:'pointer', opacity: filtroNivelTab==='Maternal'?1:0.4}}>MATERNAL</span>
               <span onClick={()=>setFiltroNivelTab('Preescolar')} className="type-pill pill-mensual" style={{cursor:'pointer', opacity: filtroNivelTab==='Preescolar'?1:0.4}}>PREESCOLAR</span>
               <span onClick={()=>setFiltroNivelTab('DEUDORES')} className="type-pill" style={{backgroundColor: '#ce1414', cursor:'pointer', opacity: filtroNivelTab==='DEUDORES'?1:0.4, marginLeft: '10px', border: '2px solid white'}}>⚠️ VER ADEUDOS</span>
               <span onClick={()=>setFiltroNivelTab('HISTORIAL')} className="type-pill" style={{backgroundColor: '#607D8B', cursor:'pointer', opacity: filtroNivelTab==='HISTORIAL'?1:0.4}}>📂 HISTORIAL</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{textAlign:'left', paddingLeft:'20px'}}>Alumno</th>
                <th>Nivel</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {pagosTabla.length > 0 ? (
                pagosTabla.map(p => (
                  <tr key={p.id}>
                    <td style={{textAlign:'left', paddingLeft:'20px', fontWeight:'bold'}}>{p.tutor}</td>
                    <td><span className={`badge badge-${p.nivel.toLowerCase()}`}>{p.nivel}</span></td>
                    <td><span className={`type-pill pill-${p.tipo.toLowerCase()}`} style={{fontSize:'0.65rem', margin:0}}>{p.tipo}</span></td>
                    <td style={{fontWeight:'bold', color:'#0277BD'}}>${p.monto.toLocaleString()}</td>
                    <td style={{fontSize:'0.8rem'}}>{obtenerFechaVencimiento(p.fecha, p.tipo)}</td>
                    <td style={{color: calcularEstadoPago(p.fecha, p.tipo).includes('⚠️') ? '#ce1414' : '#2E7D32', fontWeight:'bold'}}>
                      {calcularEstadoPago(p.fecha, p.tipo)}
                      <div style={{fontSize:'0.6rem', fontWeight:'normal', opacity:0.6, marginTop:'4px'}}>Último: {formatearFecha(p.fecha)}</div>
                    </td>
                    <td className="no-print">
                      <button onClick={()=>eliminarRegistroPago(p.id)} style={{border:'none', background:'none', cursor:'pointer'}}>🗑️</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{padding:'40px', color:'#999', fontStyle:'italic'}}>Selecciona una categoría arriba para ver los registros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modoSuper && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#fff', zIndex: 9999, padding: '20px', display: 'flex', flexDirection: 'column'}}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#000080' }}>🛒 Lista de Súper</h2>
            <button onClick={() => setModoSuper(false)} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#f44336', color: 'white', border: 'none', fontWeight: 'bold' }}>Salir</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {productosCocina.map(p => (
              <div key={p.id} onClick={() => toggleComprado(p.id, p.comprado)} style={{ display: 'flex', alignItems: 'center', padding: '20px', borderBottom: '1px solid #eee', backgroundColor: p.comprado ? '#f9f9f9' : '#fff', borderRadius: '12px', marginBottom: '10px' }}>
                <input type="checkbox" checked={p.comprado || false} readOnly style={{ transform: 'scale(1.8)', marginRight: '20px' }} />
                <span style={{ fontSize: '1.2rem', textDecoration: p.comprado ? 'line-through' : 'none', color: p.comprado ? '#999' : '#333' }}>{p.nombre}</span>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center', padding:'15px', backgroundColor:'#E1F5FE', borderRadius:'12px', marginTop:'10px'}}>
             <strong style={{color:'#0277BD'}}>Carrito: ${productosCocina.filter(p=>p.comprado).reduce((acc,c)=>acc+(Number(c.precio)||0),0).toLocaleString()}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;