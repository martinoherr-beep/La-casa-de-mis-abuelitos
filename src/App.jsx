import React, { useState, useEffect } from 'react';
import { calcularEstadoPago, obtenerFechaVencimiento } from './logicaPagos';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

function App() {
  // --- ESTADOS DE SEGURIDAD ---
  const [autenticado, setAutenticado] = useState(false);
  const [pin, setPin] = useState('');
  const PIN_CORRECTO = "1707"; // <--- TU CONTRASEÑA

  // --- ESTADOS DE DATOS ---
  const [pagos, setPagos] = useState([]);
  const [listaPapas, setListaPapas] = useState([]);
  const [productosCocina, setProductosCocina] = useState([]);
  const [gastosServicios, setGastosServicios] = useState({ luz: 0, agua: 0, nomina: 0 });
  const [fechaCalendario, setFechaCalendario] = useState(new Date());
  const [recordatorios, setRecordatorios] = useState([]);
  const [textoRecordatorio, setTextoRecordatorio] = useState('');

  const [filtroNivelTab, setFiltroNivelTab] = useState(null); 
  const [busqueda, setBusqueda] = useState('');
  const [verDetalleProyeccion, setVerDetalleProyeccion] = useState(false);
  const [modoCelular, setModoCelular] = useState(false); 
  
  const [nuevoPapa, setNuevoPapa] = useState({ nombre: '', nivel: 'Maternal' });
  const [nuevoItemCocina, setNuevoItemCocina] = useState('');
  const [nuevoPago, setNuevoPago] = useState({
    tutor: '', monto: '', tipo: 'Semanal',
    fecha: new Date().toISOString().split('T')[0]
  });

  const [fechaProyeccion, setFechaProyeccion] = useState(new Date().toISOString().split('T')[0]);

  // --- LÓGICA DE REINICIO SEMANAL ---
  const getLunesActual = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const lunes = new Date(d.setDate(diff));
    lunes.setHours(0, 0, 0, 0);
    return lunes;
  };

  const getDomingoActual = () => {
    const lunes = getLunesActual();
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);
    return domingo;
  };

  // --- LÓGICA DE LOGIN ---
  const manejarPin = (num) => {
    if (pin.length < 4) {
      const nuevoPin = pin + num;
      setPin(nuevoPin);
      if (nuevoPin === PIN_CORRECTO) {
        setTimeout(() => setAutenticado(true), 300);
      } else if (nuevoPin.length === 4) {
        setTimeout(() => setPin(''), 500); 
      }
    }
  };

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
    onSnapshot(query(collection(db, "recordatorios"), orderBy("fecha", "asc")), (snap) => {
      setRecordatorios(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });
  }, []);

  const toggleComprado = async (id, compradoActual) => {
    await updateDoc(doc(db, "cocina", id), { comprado: !compradoActual });
  };

  const registrarPapa = async (e) => {
    e.preventDefault();
    if (!nuevoPapa.nombre.trim()) return;
    await addDoc(collection(db, "alumnos"), { ...nuevoPapa });
    setNuevoPapa({ nombre: '', nivel: 'Maternal' });
  };

  const eliminarAlumno = async (id, nombre) => {
    if (confirm(`¿Eliminar a ${nombre} de la lista de alumnos?`)) await deleteDoc(doc(db, "alumnos", id));
  };

  const manejarEnvioPago = async (e) => {
    e.preventDefault();
    const papa = listaPapas.find(p => p.nombre === nuevoPago.tutor);
    if (!papa) return alert("Selecciona un alumno");
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

  const eliminarProductoCocina = async (id) => {
    await deleteDoc(doc(db, "cocina", id));
  };

  const resetearCocina = async () => {
    if (confirm("¿Es lunes? Se limpiarán los precios y checks de la lista del mandado.")) {
      productosCocina.forEach(async (p) => await updateDoc(doc(db, "cocina", p.id), { precio: 0, comprado: false }));
    }
  };

  const consultarMenuIA = () => {
    if (productosCocina.length === 0) return alert("Agrega productos al mandado primero.");
    const ingredientes = productosCocina.map(p => p.nombre).join(", ");
    const prompt = `Actúa como nutriólogo de guardería. Tengo estos ingredientes: ${ingredientes}. Sugiere 5 desayunos y 5 comidas saludables. Responde breve.`;
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, "_blank");
  };

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "-";
    const soloFecha = fechaStr.includes('T') ? fechaStr.split('T')[0] : fechaStr;
    const [year, month, day] = soloFecha.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  const obtenerSemanaDelCiclo = (pagoActual, fechaReferencia = null) => {
    if (pagoActual.tipo === 'Semanal') return null;
    const fBase = new Date(pagoActual.fecha + "T00:00:00");
    const fRef = fechaReferencia ? new Date(fechaReferencia + "T00:00:00") : new Date();
    const diff = Math.floor((fRef - fBase) / (1000 * 60 * 60 * 24));
    const sem = Math.floor(diff / 7) + 1;
    const lim = pagoActual.tipo === 'Quincenal' ? 2 : 4;
    return `Semana ${sem > lim ? 1 : sem} de ${lim}`;
  };

  const agregarRecordatorio = async (e) => {
    e.preventDefault();
    if (!textoRecordatorio.trim()) return;
    await addDoc(collection(db, "recordatorios"), {
      texto: textoRecordatorio,
      fecha: fechaCalendario.toISOString().split('T')[0],
      completado: false
    });
    setTextoRecordatorio('');
  };

  // --- CÁLCULOS SEMANALES ---
  const lunesRef = getLunesActual();
  const domingoRef = getDomingoActual();
  const pagosEstaSemana = pagos.filter(p => {
    const f = new Date(p.fecha + "T00:00:00");
    return f >= lunesRef && f <= domingoRef;
  });

  const totalIngresosSemana = pagosEstaSemana.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const totalMandadoPresupuestado = productosCocina.reduce((acc, p) => acc + (Number(p.precio) || 0), 0);
  const totalServicios = (Number(gastosServicios.luz) || 0) + (Number(gastosServicios.agua) || 0) + (Number(gastosServicios.nomina) || 0);
  const balanceReal = totalIngresosSemana - totalMandadoPresupuestado - totalServicios;
  const totalPorTipo = (tipo) => pagosEstaSemana.filter(p => p.tipo === tipo).reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  const totalServiciosNum = Number(totalServicios) || 0;
  const totalIngresosNum = Number(totalIngresosSemana) || 0;
  const porcentajeMeta = totalServiciosNum > 0 ? Math.min((totalIngresosNum / totalServiciosNum) * 100, 100) : 0;
  const faltaParaMeta = Math.max(0, totalServiciosNum - totalIngresosNum);

  const alumnosProyeccion = listaPapas.map(papa => {
    const todosSusPagos = pagos.filter(p => p.tutor === papa.nombre).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const ultimoPago = todosSusPagos[0];
    if (!ultimoPago) return null;
    const lunesC = new Date(fechaProyeccion + "T00:00:00");
    const domingoC = new Date(lunesC); 
    domingoC.setDate(lunesC.getDate() + 6);
    let fProx = new Date(ultimoPago.fecha + "T00:00:00");
    if (ultimoPago.tipo === 'Semanal') fProx.setDate(fProx.getDate() + 7);
    else if (ultimoPago.tipo === 'Quincenal') fProx.setDate(fProx.getDate() + 14);
    else if (ultimoPago.tipo === 'Mensual') fProx.setMonth(fProx.getMonth() + 1);
    if (fProx >= lunesC && fProx <= domingoC) {
        return { nombre: papa.nombre, monto: ultimoPago.monto, tipo: ultimoPago.tipo, fechaUltima: ultimoPago.fecha };
    }
    return null;
  }).filter(x => x !== null);

  const proyeccionLunes = alumnosProyeccion.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  const pagosTabla = filtroNivelTab === 'DEUDORES'
  ? pagos.filter(p => {
      const esUltimo = !pagos.some(o => o.tutor === p.tutor && new Date(o.fecha) > new Date(p.fecha));
      return esUltimo && calcularEstadoPago(p.fecha, p.tipo).includes('⚠️') && p.tutor.toLowerCase().includes(busqueda.toLowerCase());
    })
  : filtroNivelTab === 'HISTORIAL' ? pagos.filter(p => p.tutor.toLowerCase().includes(busqueda.toLowerCase())) 
  : filtroNivelTab ? pagosEstaSemana.filter(p => p.nivel === filtroNivelTab && p.tutor.toLowerCase().includes(busqueda.toLowerCase()))
  : pagosEstaSemana.filter(p => p.tutor.toLowerCase().includes(busqueda.toLowerCase()));

// --- VISTA DE LOGIN ESTILO CALIGRAFÍA MODERNA ---
  if (!autenticado) {
    return (
      <div style={{ 
        height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', 
        justifyContent: 'center', background: '#1a1a1a', color: 'white', 
        fontFamily: 'Segoe UI', overflow: 'hidden' 
      }}>
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', 
          width: '100%', maxWidth: '350px', padding: '10px' 
        }}>
          
          <img src="https://res.cloudinary.com/dvikeqkst/image/upload/v1776960704/logo_casa_wxquvl.png" 
               alt="Logo" style={{ width: '80px', marginBottom: '15px', borderRadius: '50%' }} />
          
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
             <h2 style={{ fontWeight: '300', letterSpacing: '4px', fontSize: '0.65rem', opacity: 0.5, margin: '0 0 5px 0',  }}>ADMINISTRADOR</h2>
             <h1 style={{ 
               fontFamily: "'Dancing Script', cursive", 
               fontSize: '2.8rem', // Aumentamos tamaño porque esta fuente es más delgada
               color: '#fff', 
               margin: '0',
               fontWeight: '700', // Negrita para imitar el trazo grueso de la imagen
               lineHeight: '1',
               textShadow: '0 0 20px rgba(255,255,255,0.1)'
             }}>
               Tere Torres
             </h1>
          </div>
          
          {/* Puntos de PIN */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '25px' }}>
            {[1, 2, 3, 4].map((_, i) => (
              <div key={i} style={{ 
                width: '14px', height: '14px', borderRadius: '50%', 
                background: pin.length > i ? '#0288D1' : '#333', 
                boxShadow: pin.length > i ? '0 0 10px #0288D1' : 'none',
                transition: '0.3s' 
              }}></div>
            ))}
          </div>

          {/* Teclado numérico compacto */}
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(3, 70px)', 
            gap: '15px', justifyContent: 'center' 
          }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} onClick={() => manejarPin(num.toString())} style={{ 
                height: '70px', width: '70px', borderRadius: '50%', border: '1px solid #444', 
                background: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '1.5rem', 
                cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.background = 'rgba(2, 136, 209, 0.2)';
                e.target.style.borderColor = '#0288D1';
              }}
              onMouseOut={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.03)';
                e.target.style.borderColor = '#444';
              }}
              >
                {num}
              </button>
            ))}
            <button style={{ background: 'transparent', border: 'none' }}></button>
            <button onClick={() => manejarPin('0')} 
              style={{ 
                height: '70px', width: '70px', borderRadius: '50%', border: '1px solid #444', 
                background: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '1.5rem', cursor: 'pointer'
              }}
              onMouseOver={(e) => { e.target.style.background = 'rgba(2, 136, 209, 0.2)'; e.target.style.borderColor = '#0288D1'; }}
              onMouseOut={(e) => { e.target.style.background = 'rgba(255,255,255,0.03)'; e.target.style.borderColor = '#444'; }}
            >0</button>
            <button onClick={() => setPin('')} style={{ 
                border: 'none', background: 'transparent', color: '#0288D1', 
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px'
            }}>BORRAR</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-root">
      <style>{`
        
       @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400..700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #eaeff5; font-family: 'Segoe UI', sans-serif; min-height: 100vh; }
        .layout-root { display: flex; justify-content: center; width: 100vw; min-height: 100vh; }
        .main-wrapper { width: 100%; max-width: 1200px; padding: 15px; display: flex; flex-direction: column; }
        .header { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 25px; flex-wrap: wrap; }
        .header h1 { color: #f31c1c; font-size: 2.2rem; font-weight: 900; margin: 0; }
        .header-logo { width: 90px; height: 120px; object-fit: contain; border-radius: 50%; }
        .card { background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .summary-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 20px; }
        @media (min-width: 768px) { .summary-grid { grid-template-columns: 1.5fr 1fr; } }
        .summary-card { background: #ffffff; color: #0277BD; padding: 25px; position: relative; border-left: 8px solid #0277BD; }
        .balance-card { background: #d7e2f5; color: #565656; border: 2px solid #a0bafa; text-align: center; }
        .type-pill { padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; margin-right: 8px; color: white; display: inline-block; }
        .pill-semanal { background-color: #7B1FA2; } .pill-quincenal { background-color: #0288D1; } .pill-mensual { background-color: #EF6C00; }
        .grid-layout { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px; }
        @media (min-width: 768px) { .grid-layout { grid-template-columns: repeat(3, 1fr); } }
        .grid-special-row { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px; }
        @media (min-width: 768px) { .grid-special-row { grid-template-columns: 1fr 1fr; } }
        .input-box { width: 100%; padding: 12px; margin-top: 8px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; background: #fdfdfd; color: #000; }
        .btn-submit { width: 100%; padding: 14px; background: #0277BD; color: white; border: none; border-radius: 10px; font-weight: bold; margin-top: 12px; cursor: pointer; }
        .notebook { background: white; border-radius: 8px; box-shadow: 3px 3px 10px rgba(0,0,0,0.1); padding: 30px 15px 15px 45px; position: relative; background-image: linear-gradient(#e5e5e5 1px, transparent 1px); background-size: 100% 28px; height: 420px; display: flex; flex-direction: column; color: #000; font-family: 'Courier New', Courier, monospace; }
        .notebook::before { content: ''; position: absolute; top: 0; left: 35px; width: 2px; height: 100%; background: #ffadad; }
        .notebook-content { flex: 1; overflow-y: auto; padding-right: 5px; margin-top: 5px; }
        .product-row { display: flex; justify-content: space-between; align-items: center; height: 28px; color: #000; }
        .product-left { display: flex; align-items: center; width: 70%; }
        .product-name { color: #000080; font-weight: bold; margin-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .notebook-input { border: none; border-bottom: 1px dashed #999; width: 60px; text-align: right; background: transparent; font-family: inherit; font-weight: bold; color: #ce1414 !important; outline: none; }
        .btn-delete-item { background: #ff7675; border: none; color: white; cursor: pointer; font-size: 0.6rem; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 8px; }
        .notebook-add-input { border: none; border-bottom: 2px solid #ce1414; background: rgba(255, 255, 255, 0.8); width: 100%; padding: 10px; font-family: inherit; font-size: 1rem; font-weight: bold; outline: none; margin-bottom: 15px; color: #000 !important; }
        .alumnos-scroll-container { margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px; max-height: 180px; overflow-y: auto; }
        .alumno-item-list { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f9f9f9; }
        .badge { padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; display: inline-block; }
        .badge-lactantes { background: #E1F5FE; color: #0288D1; } .badge-maternal { background: #F3E5F5; color: #7B1FA2; } .badge-preescolar { background: #FFF3E0; color: #EF6C00; }
        .super-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #ffffff; z-index: 10000; display: flex; flex-direction: column; padding: 15px; }
        .super-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #ce1414; padding-bottom: 10px; margin-bottom: 15px; }
        .super-title { color: #ce1414; font-size: 1.5rem; font-weight: 900; }
        .super-close-btn { background: #333; color: white; border: none; padding: 8px 15px; border-radius: 10px; font-weight: bold; }
        .table-scroll { overflow-x: auto; background: white; border-radius: 15px; }
        table { width: 100%; border-collapse: collapse; min-width: 850px; }
        .input-group { position: relative; margin-top: 10px; }
        .input-icon { position: absolute; left: 10px; top: 12px; font-size: 1.2rem; }
        .input-with-icon { padding-left: 40px !important; }
        th { background: #F8FAFC; padding: 15px; font-size: 0.7rem; color: #64748B; text-transform: uppercase; }
        td { padding: 15px; border-bottom: 1px solid #F1F5F9; text-align: center; color: #333; }
        .dashboard-footer-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 992px) { .dashboard-footer-grid { grid-template-columns: 1.2fr 0.8fr; } }
        .react-calendar { border: none !important; width: 100% !important; border-radius: 12px; font-family: inherit !important; }
        .react-calendar__tile { color: #333 !important; }
        .react-calendar__navigation button { color: #f31c1c; font-weight: bold; }
        .react-calendar__tile--active { background: #f31c1c !important; color: white !important; border-radius: 8px; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {modoCelular && (
        <div className="super-overlay no-print">
          <div className="super-header"><div className="super-title">🛒 LISTA DEL MANDADO</div><button className="super-close-btn" onClick={() => setModoCelular(false)}>CERRAR X</button></div>
          <div style={{flex:1, overflowY:'auto'}}>
            {productosCocina.map(p => (
              <div key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'18px 10px', borderBottom:'1px solid #eee', fontSize:'1.2rem'}} onClick={() => toggleComprado(p.id, p.comprado)}>
                <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                  <div style={{width:'30px', height:'30px', border:'2px solid #ce1414', borderRadius:'8px', display:'flex', alignItems:'center', justifyItems:'center', background:p.comprado?'#4CAF50':'white', color:'white', textAlign:'center', justifyContent:'center'}}>{p.comprado?'✓':''}</div>
                  <span style={{textDecoration:p.comprado?'line-through':'none', color:p.comprado?'#999':'#333', fontWeight:'600'}}>{p.nombre}</span>
                </div>
                <div style={{color:'#ce1414', fontWeight:'900'}}>${p.precio}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="main-wrapper">
        <header className="header">
          <div style={{display:'flex', width:'100%', justifyContent:'space-between', alignItems:'center'}}>
            <img src="https://res.cloudinary.com/dvikeqkst/image/upload/v1776960704/logo_casa_wxquvl.png" alt="Logo" className="header-logo no-print" />
            <div className="header-text-container" style={{textAlign:'center'}}><h1>La Casa de mis Abuelitos</h1><p style={{ letterSpacing: '1px', fontSize: '0.85rem', color: '#64748B', margin: 0 }}>ADMINISTRACIÓN SEMANAL</p></div>
            <button onClick={() => setAutenticado(false)} style={{background:'none', border:'1px solid #ddd', padding:'8px', borderRadius:'10px', cursor:'pointer'}}>🔒</button>
          </div>
        </header>

        {/* ALERTA RECORDATORIOS */}
        {recordatorios.filter(r => r.fecha === new Date().toISOString().split('T')[0]).length > 0 && (
          <div className="no-print" style={{ background: '#f31c1c', color: 'white', padding: '15px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 4px 15px rgba(243, 28, 28, 0.3)' }}>
            <strong>📢 PENDIENTES PARA HOY:</strong>
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              {recordatorios.filter(r => r.fecha === new Date().toISOString().split('T')[0]).map(r => (
                <li key={r.id}>{r.texto}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="summary-grid">
          <div className="card summary-card">
            <span style={{fontSize:'0.7rem', fontWeight:'900'}}>RECAUDACIÓN SEMANAL</span>
            <h2 style={{fontSize: '2.5rem', margin:'5px 0'}}>${totalIngresosSemana.toLocaleString()}</h2>
            <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
               <span className="type-pill pill-semanal">Semanal: ${totalPorTipo('Semanal').toLocaleString()}</span>
               <span className="type-pill pill-quincenal">Quincenal: ${totalPorTipo('Quincenal').toLocaleString()}</span>
               <span className="type-pill pill-mensual">Mensualidad: ${totalPorTipo('Mensual').toLocaleString()}</span>
            </div>
            <p style={{fontSize:'0.6rem', marginTop:'5px', color:'#666'}}>Semana del {formatearFecha(lunesRef.toISOString().split('T')[0])} al {formatearFecha(domingoRef.toISOString().split('T')[0])}</p>
          </div>
          <div className="card balance-card">
            <span style={{fontSize:'0.7rem', fontWeight:'900'}}>CAJA REAL (NETO)</span>
            <h2 style={{fontSize: '2.5rem', margin:'5px 0'}}>${balanceReal.toLocaleString()}</h2>
            <div style={{fontSize:'0.65rem', color:'#555'}}>Mandado: -${totalMandadoPresupuestado.toLocaleString()} | Gastos Fijos: -${totalServicios.toLocaleString()}</div>
          </div>
        </div>

        <div className="no-print grid-layout">
          <div className="card" style={{background:'#efcccc', border:'1px solid #f38181'}}>
            <h3 style={{color:'#494949', fontSize:'1.1rem', marginBottom:'10px'}}>🔌 Gastos Fijos</h3>
            <div className="input-group">
              <span className="input-icon">⚡</span>
              <input type="number" className="input-box input-with-icon" value={gastosServicios.luz} onChange={(e) => actualizarServicio('luz', e.target.value)} placeholder="Luz" />
              <small style={{color:'#f57f18', fontWeight:'bold', marginLeft:'5px'}}>LUZ</small>
            </div>
            <div className="input-group">
              <span className="input-icon">💧</span>
              <input type="number" className="input-box input-with-icon" value={gastosServicios.agua} onChange={(e) => actualizarServicio('agua', e.target.value)} placeholder="Agua" />
              <small style={{color:'#0288D1', fontWeight:'bold', marginLeft:'5px'}}>AGUA</small>
            </div>
            <div className="input-group">
              <span className="input-icon">👥</span>
              <input type="number" className="input-box input-with-icon" value={gastosServicios.nomina} onChange={(e) => actualizarServicio('nomina', e.target.value)} placeholder="Nómina" />
              <small style={{color:'#7B1FA2', fontWeight:'bold', marginLeft:'5px'}}>NÓMINA</small>
            </div>
          </div>

          <div className="card">
            <h3 style={{ color: '#0277BD', fontSize: '1.1rem' }}>👤 Control de Niños</h3>
            <form onSubmit={registrarPapa}><input placeholder="Nombre" value={nuevoPapa.nombre} onChange={(e) => setNuevoPapa({ ...nuevoPapa, nombre: e.target.value })} className="input-box" required /><select value={nuevoPapa.nivel} onChange={(e) => setNuevoPapa({ ...nuevoPapa, nivel: e.target.value })} className="input-box"><option value="Lactantes">Lactantes</option><option value="Maternal">Maternal</option><option value="Preescolar">Preescolar</option></select><button type="submit" className="btn-submit">Dar de Alta</button></form>
            <div className="alumnos-scroll-container">
              {listaPapas.map(p => (
                <div key={p.id} className="alumno-item-list"><div><b>{p.nombre}</b><br/><span className={`badge badge-${p.nivel.toLowerCase()}`}>{p.nivel}</span></div><button onClick={() => eliminarAlumno(p.id, p.nombre)} style={{border:'none', background:'none'}}>🗑️</button></div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{color: '#404040', fontSize:'1.1rem'}}>💰 Registro de Pago</h3>
            <form onSubmit={manejarEnvioPago}>
              <select value={nuevoPago.tutor} onChange={(e)=>setNuevoPago({...nuevoPago, tutor: e.target.value})} className="input-box" required><option value="">-- Seleccionar --</option>{listaPapas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}</select>
              <input type="number" placeholder="Monto $" value={nuevoPago.monto} onChange={(e)=>setNuevoPago({...nuevoPago, monto: e.target.value})} className="input-box" required />
              <select value={nuevoPago.tipo} onChange={(e)=>setNuevoPago({...nuevoPago, tipo: e.target.value})} className="input-box"><option value="Semanal">Semanal</option><option value="Quincenal">Quincenal</option><option value="Mensual">Mensual</option></select>
              <input type="date" value={nuevoPago.fecha} onChange={(e)=>setNuevoPago({...nuevoPago, fecha: e.target.value})} className="input-box" style={{background:'#464646', color:'#fff'}} />
              <button type="submit" className="btn-submit" style={{background:'#039BE5'}}>Guardar</button>
            </form>
          </div>
        </div>

        <div className="no-print grid-special-row">
          <div className="card" style={{ borderTop: '5px solid #5e81d9', background: '#b4c7f7' }}>
            <h3 style={{ color: '#383838', fontSize: '1.1rem' }}>📈 Punto de Equilibrio</h3>
            <div style={{ background: '#ffffff', borderRadius: '10px', height: '22px', overflow:'hidden', marginTop:10 }}><div style={{ background: porcentajeMeta >= 100 ? '#4CAF50' : '#FF9800', height: '100%', width: `${porcentajeMeta}%`, color:'darkgrey', textAlign:'center', fontSize:12, fontWeight: 'bold', transition: 'width 0.5s ease' }}>{Math.round(porcentajeMeta)}%</div></div>
            <div style={{textAlign:'right', marginTop:5, color: '#272727', fontWeight: 'bold'}}>{porcentajeMeta >= 100 ? '✅ Cubierto' : `Faltan: $${faltaParaMeta.toLocaleString()}`}</div>
          </div>

          <div className="card" style={{ borderTop: '5px solid #b454f9', background: '#e8c7ff', position: 'relative', height: '230px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h3 style={{ color: '#363636', fontSize: '1.1rem' }}>🔮 Cobranza Estimada</h3>
            <button onClick={() => setVerDetalleProyeccion(!verDetalleProyeccion)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'white', border: '1px solid #0288D1', borderRadius: '8px', padding: 5, cursor: 'pointer', zIndex: 10 }}>📋</button>
            <input type="date" value={fechaProyeccion} onChange={(e) => setFechaProyeccion(e.target.value)} style={{ marginTop: 10, padding: 5, borderRadius: 5, border: '1px solid #0288D1', width: 'fit-content' }} />
            <div style={{ textAlign: 'right', fontSize: '1.4rem', fontWeight: '900', color: '#363636', marginBottom: '5px' }}>${proyeccionLunes.toLocaleString()}</div>
            {verDetalleProyeccion && (
              <div style={{ background: 'white', padding: '10px', borderRadius: '10px', overflowY: 'auto', maxHeight: '100px', fontSize: 12, border: '1px solid #b3e5fc' }}>
                {alumnosProyeccion.length > 0 ? alumnosProyeccion.map((al, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid #eee', padding: '6px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold' }}>{al.nombre}</span>
                      <b style={{ color: '#0288D1' }}>${(Number(al.monto) || 0).toLocaleString()}</b>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', marginTop: '2px', alignItems: 'center' }}>
                      <span className={`type-pill pill-${al.tipo?.toLowerCase()}`} style={{ fontSize: '0.55rem', padding: '1px 6px', margin: 0 }}>{al.tipo}</span>
                      <span style={{ fontSize: '0.6rem', color: '#666', fontStyle: 'italic' }}>
                        {obtenerSemanaDelCiclo({ fecha: al.fechaUltima, tipo: al.tipo }, fechaProyeccion)}
                      </span>
                    </div>
                  </div>
                )) : <div style={{ textAlign: 'center', color: '#999' }}>No hay pendientes.</div>}
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-footer-grid">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ color: '#ce1414' }}>🛒 Lista del Mandado</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="no-print" onClick={resetearCocina} style={{ background: '#6a6a6a', padding: '8px 12px', borderRadius: '8px', fontSize: '0.7rem' }}>🔄 RESET</button>
                <button className="no-print" onClick={() => setModoCelular(true)} style={{ background: '#2b2b2b', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.7rem' }}>🛒 MODO SÚPER</button>
              </div>
            </div>
            <form onSubmit={agregarProductoCocina}><input className="notebook-add-input" placeholder="+ Producto..." value={nuevoItemCocina} onChange={(e)=>setNuevoItemCocina(e.target.value)} /></form>
            <div className="notebook"><div className="notebook-content">
                {productosCocina.map(p => (
                  <div key={p.id} className="product-row" style={{ opacity: p.comprado ? 0.5 : 1 }}><div className="product-left"><button className="btn-delete-item no-print" onClick={() => eliminarProductoCocina(p.id)}>✖</button><input type="checkbox" checked={p.comprado || false} onChange={() => toggleComprado(p.id, p.comprado)} /><span className="product-name" style={{ textDecoration: p.comprado ? 'line-through' : 'none' }}>• {p.nombre}</span></div><span>$ <input type="number" className="notebook-input" value={p.precio} onChange={(e)=>updateDoc(doc(db,"cocina",p.id),{precio:parseFloat(e.target.value)||0})} /></span></div>
                ))}
              </div>
              <div style={{marginTop:'auto', textAlign:'right', borderTop:'2px solid #ce1414', paddingTop:10}}><strong>Mandado: ${totalMandadoPresupuestado.toLocaleString()}</strong><button className="no-print" onClick={consultarMenuIA} style={{display: 'block', width: '100%', padding: '10px', borderRadius: '10px', background: 'linear-gradient(45deg, #7B1FA2, #0288D1)', color: 'white', fontWeight: 'bold', border:'none', marginTop:10}}>✨ SUGERIR MENÚS IA</button></div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ color: '#333', marginBottom: '15px' }}>📅 Calendario y Agenda</h3>
            <Calendar onChange={setFechaCalendario} value={fechaCalendario} locale="es-MX" />
            <form onSubmit={agregarRecordatorio} style={{ marginTop: '15px' }}>
              <input className="input-box" placeholder="Nuevo evento o pago..." value={textoRecordatorio} onChange={(e) => setTextoRecordatorio(e.target.value)} />
              <button type="submit" className="btn-submit" style={{ background: '#f31c1c', fontSize: '0.8rem', padding: '10px' }}>
                Agendar para {fechaCalendario.toLocaleDateString('es-MX', {day: 'numeric', month: 'short'})}
              </button>
            </form>
            <div style={{ marginTop: '15px', maxHeight: '120px', overflowY: 'auto', background: '#f8f9fa', padding: '10px', borderRadius: '10px' }}>
              <small style={{ fontWeight: 'bold', color: '#666' }}>Eventos del día seleccionado:</small>
              {recordatorios.filter(r => r.fecha === fechaCalendario.toISOString().split('T')[0]).map(r => (
                <div key={r.id} style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', borderBottom: '1px dashed #ddd', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>• {r.texto} <span style={{ color: '#ce1414', fontSize: '0.75rem', marginLeft: '5px' }}>({formatearFecha(r.fecha)})</span></span>
                    <button onClick={() => deleteDoc(doc(db, "recordatorios", r.id))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TABLA DE PAGOS */}
        <div className="card table-scroll" style={{padding:'0'}}>
          <div style={{padding:'20px', display:'flex', gap:'5px', flexWrap:'wrap'}}>
             <span onClick={()=>setFiltroNivelTab('Lactantes')} className={`type-pill ${filtroNivelTab==='Lactantes'?'pill-quincenal':''}`} style={{cursor:'pointer', backgroundColor: filtroNivelTab==='Lactantes'?'#0288D1':'#607D8B'}}>LACTANTES</span>
             <span onClick={()=>setFiltroNivelTab('Maternal')} className={`type-pill ${filtroNivelTab==='Maternal'?'pill-semanal':''}`} style={{cursor:'pointer', backgroundColor: filtroNivelTab==='Maternal'?'#7B1FA2':'#607D8B'}}>MATERNAL</span>
             <span onClick={()=>setFiltroNivelTab('Preescolar')} className={`type-pill ${filtroNivelTab==='Preescolar'?'pill-mensual':''}`} style={{cursor:'pointer', backgroundColor: filtroNivelTab==='Preescolar'?'#EF6C00':'#607D8B'}}>PREESCOLAR</span>
             <span onClick={()=>setFiltroNivelTab('DEUDORES')} className="type-pill" style={{backgroundColor: '#ce1414', cursor:'pointer', border: filtroNivelTab==='DEUDORES'?'2px solid black':'none'}}>⚠️ RECAUDACIÓN DE DEUDORES</span>
             <span onClick={()=>setFiltroNivelTab('HISTORIAL')} className="type-pill" style={{backgroundColor: '#607D8B', cursor:'pointer', opacity: filtroNivelTab==='HISTORIAL'?1:0.6}}>📂 HISTORIAL</span>
             <span onClick={()=>setFiltroNivelTab(null)} className="type-pill" style={{backgroundColor: '#4CAF50', cursor:'pointer', opacity: !filtroNivelTab?1:0.6}}>📅 ESTA SEMANA</span>
          </div>
          <table>
            <thead><tr><th>Madre/Padre</th><th>Tipo y Ciclo</th><th>Monto</th><th>Estado</th><th className="no-print"></th></tr></thead>
            <tbody>
              {pagosTabla.length > 0 ? pagosTabla.map(p => (
                <tr key={p.id}>
                  <td style={{textAlign:'left', paddingLeft:'20px'}}><b>{p.tutor.replace(/pago de|pago|de/gi, '').trim()}</b><br/><small style={{opacity: 0.7}}>{p.nivel}</small></td>
                  <td><span className={`type-pill pill-${p.tipo.toLowerCase()}`} style={{fontSize:'0.65rem', margin:0}}>{p.tipo}</span>{obtenerSemanaDelCiclo(p) && <div style={{fontSize:'0.65rem', fontWeight:'bold', marginTop:'4px'}}>{obtenerSemanaDelCiclo(p)}</div>}</td>
                  <td><b>${Number(p.monto) ? Number(p.monto).toLocaleString() : p.monto}</b></td>
                  <td style={{color: calcularEstadoPago(p.fecha,p.tipo).includes('⚠️') ? '#ce1414' : '#2E7D32', fontWeight:'bold'}}>{calcularEstadoPago(p.fecha,p.tipo)}<div style={{fontSize:'0.6rem', fontWeight:'normal', opacity:0.6}}>Inicio: {formatearFecha(p.fecha)}</div></td>
                  <td className="no-print"><button onClick={()=>deleteDoc(doc(db,"pagos",p.id))} style={{border:'none', background:'none'}}>🗑️</button></td>
                </tr>
              )) : <tr><td colSpan="7" style={{padding:'40px', color:'#999', fontStyle:'italic'}}>Sin registros en este periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;