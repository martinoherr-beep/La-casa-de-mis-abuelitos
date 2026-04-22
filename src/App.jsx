import React, { useState, useEffect } from 'react';
import { calcularEstadoPago, obtenerFechaVencimiento } from './logicaPagos';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
// 1. IMPORTAR LA LIBRERÍA DE GOOGLE AI
import { GoogleGenerativeAI } from "@google/generative-ai";

function App() {
  const [pagos, setPagos] = useState([]);
  const [listaPapas, setListaPapas] = useState([]);
  const [productosCocina, setProductosCocina] = useState([]);
  const [gastosServicios, setGastosServicios] = useState({ luz: 0, agua: 0 });
  
  // ESTADOS PARA GEMINI
  const [menuSugerido, setMenuSugerido] = useState("");
  const [cargandoIA, setCargandoIA] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [nuevoPapa, setNuevoPapa] = useState({ nombre: '', nivel: 'Maternal' });
  const [nuevoItemCocina, setNuevoItemCocina] = useState('');
  const [nuevoPago, setNuevoPago] = useState({
    tutor: '', monto: '', tipo: 'Mensual',
    fecha: new Date().toISOString().split('T')[0]
  });

  // --- CARGA DE DATOS EN TIEMPO REAL ---
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

  // --- LÓGICA DE GEMINI ---
const consultarMenuIA = async () => {
  if (productosCocina.length === 0) return alert("Agrega productos al mandado primero.");
  
  setCargandoIA(true);
  try {
    // IMPORTANTE: Asegúrate de que la clave esté SOLA entre las comillas
    // Ejemplo correcto: const key = "AIzaSy..."
    const genAI = new GoogleGenerativeAI("AIzaSyDZs25EUv-XTSnS49wFWaWFvg2H7umzqKs");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

    const ingredientes = productosCocina.map(p => p.nombre).join(", ");
    const prompt = `Sugiere 2 desayunos y 2 comidas saludables para una guardería usando: ${ingredientes}. Responde breve en español.`;

    const result = await model.generateContent(prompt);
    setMenuSugerido(result.response.text());
    
  } catch (error) {
    console.error("Error detallado:", error);
    alert("La API Key sigue sin ser reconocida. Revisa que no falte ningún carácter al copiarla.");
  }
  setCargandoIA(false);
};

  // --- LÓGICA DE FIREBASE ---
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
    await setDoc(doc(db, "cocina", idFix), { nombre: nuevoItemCocina, precio: 0 });
    setNuevoItemCocina('');
  };

  const actualizarPrecioCocina = async (id, valor) => {
    await updateDoc(doc(db, "cocina", id), { precio: parseFloat(valor) || 0 });
  };

  const eliminarProductoCocina = async (id) => {
    if (confirm("¿Eliminar permanentemente de la lista?")) await deleteDoc(doc(db, "cocina", id));
  };

  const resetearCocina = async () => {
    if (confirm("¿Es lunes? Se limpiarán los precios.")) {
      productosCocina.forEach(async (p) => await updateDoc(doc(db, "cocina", p.id), { precio: 0 }));
    }
  };

  const eliminarRegistroPago = async (id) => {
    if (confirm("¿Borrar registro de pago?")) await deleteDoc(doc(db, "pagos", id));
  };

  // --- CÁLCULOS ---
  const pagosFiltrados = pagos.filter(p => p.tutor.toLowerCase().includes(busqueda.toLowerCase()) && (filtroCategoria === 'Todos' || p.nivel === filtroCategoria));
  const totalIngresos = pagosFiltrados.reduce((acc, p) => acc + p.monto, 0);
  const totalGastosCocina = productosCocina.reduce((acc, p) => acc + (p.precio || 0), 0);
  const totalServicios = (gastosServicios.luz || 0) + (gastosServicios.agua || 0);
  const balanceReal = totalIngresos - totalGastosCocina - totalServicios;

  const totalPorTipo = (tipo) => pagosFiltrados.filter(p => p.tipo === tipo).reduce((acc, p) => acc + p.monto, 0);
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
        .header { text-align: center; margin-bottom: 25px; }
        .header h1 { color: #ce1414; font-size: 2.2rem; font-weight: 900; }
        .card { background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        
        .summary-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 20px; }
        @media (min-width: 768px) { .summary-grid { grid-template-columns: 1.5fr 1fr; } }
        
        .summary-card { background: #B3E5FC; color: #0277BD; padding: 25px; position: relative; }
        .balance-card { background: #E8F5E9; color: #2E7D32; border: 2px solid #A5D6A7; text-align: center; display: flex; flex-direction: column; justify-content: center; }

        .type-pill { padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; margin-right: 8px; color: white; display: inline-block; }
        .pill-semanal { background-color: #7B1FA2; }
        .pill-quincenal { background-color: #0288D1; }
        .pill-mensual { background-color: #EF6C00; }

        .grid-layout { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px; }
        @media (min-width: 768px) { .grid-layout { grid-template-columns: repeat(3, 1fr); } }

        .input-box { width: 100%; padding: 12px; margin-top: 8px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; background: #fdfdfd; color: #000; }
        .btn-submit { width: 100%; padding: 14px; background: #0277BD; color: white; border: none; border-radius: 10px; font-weight: bold; margin-top: 12px; cursor: pointer; }

        /* --- CUADERNO --- */
        .notebook {
          background: white; border-radius: 8px; box-shadow: 3px 3px 10px rgba(0,0,0,0.1);
          padding: 30px 15px 15px 45px; position: relative;
          background-image: linear-gradient(#e5e5e5 1px, transparent 1px); background-size: 100% 28px;
          line-height: 28px; height: 420px; display: flex; flex-direction: column;
          font-family: 'Courier New', Courier, monospace; color: #000;
        }
        .notebook::before { content: ''; position: absolute; top: 0; left: 35px; width: 2px; height: 100%; background: #ffadad; }
        .notebook-content { flex: 1; overflow-y: auto; padding-right: 5px; }
        .notebook-content::-webkit-scrollbar { width: 4px; }
        .notebook-content::-webkit-scrollbar-thumb { background: #ffadad; border-radius: 10px; }

        .product-row { display: flex; justify-content: space-between; align-items: center; height: 28px; color: #000; }
        .product-left { display: flex; align-items: center; }
        .product-name { color: #000080; font-weight: bold; margin-left: 5px; }

        .btn-delete-item { 
          background: #ffeded; border: none; color: #ffadad; cursor: pointer; 
          font-size: 0.6rem; width: 18px; height: 18px; border-radius: 50%; 
          display: inline-flex; align-items: center; justify-content: center; 
          margin-right: 8px; opacity: 0.5; transition: all 0.2s;
        }
        .btn-delete-item:hover { opacity: 1; background: #ffadad; color: white; }

        .notebook-add-input { 
          border: none; border-bottom: 2px solid #ce1414; background: rgba(255, 255, 255, 0.8); 
          width: 100%; padding: 10px; font-family: inherit; font-size: 1rem; font-weight: bold; 
          outline: none; margin-bottom: 15px; color: #000 !important; 
        }
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
          <h1>La Casa de mis Abuelitos</h1>
          <p style={{letterSpacing:'2px', fontSize:'0.8rem', color:'#64748B'}}>GESTIÓN INTEGRAL MOAPP</p>
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
              Cocina: -${totalGastosCocina.toLocaleString()} | Servicios: -${totalServicios.toLocaleString()}
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
            <h3 style={{color: '#0277BD', fontSize:'1.1rem'}}>👤 Alumno</h3>
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
            <h3 style={{color: '#0277BD', fontSize:'1.1rem'}}>💰 Pago</h3>
            <form onSubmit={manejarEnvioPago}>
              <select value={nuevoPago.tutor} onChange={(e)=>setNuevoPago({...nuevoPago, tutor: e.target.value})} className="input-box" required>
                <option value="">-- Seleccionar --</option>
                {listaPapas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
              <input type="number" placeholder="Monto $" value={nuevoPago.monto} onChange={(e)=>setNuevoPago({...nuevoPago, monto: e.target.value})} className="input-box" required />
              <div style={{display:'flex', gap:'5px'}}>
                <select value={nuevoPago.tipo} onChange={(e)=>setNuevoPago({...nuevoPago, tipo: e.target.value})} className="input-box">
                  <option value="Semanal">Semanal</option>
                  <option value="Quincenal">Quincenal</option>
                  <option value="Mensual">Mensual</option>
                </select>
                <input type="date" value={nuevoPago.fecha} onChange={(e)=>setNuevoPago({...nuevoPago, fecha: e.target.value})} className="input-box" />
              </div>
              <button type="submit" className="btn-submit" style={{background:'#039BE5'}}>Guardar</button>
            </form>
          </div>
        </div>

        {/* LISTA MANDADO (CUADERNO) */}
        <div className="notebook card">
          <h3 style={{color: '#ce1414', fontFamily:'serif', fontSize:'1.2rem', marginBottom: '10px'}}>Lista Mandado</h3>
          <form onSubmit={agregarProductoCocina} className="no-print">
            <input className="notebook-add-input" placeholder="+ Nuevo producto..." value={nuevoItemCocina} onChange={(e)=>setNuevoItemCocina(e.target.value)} />
          </form>
          
          <div className="notebook-content">
            {productosCocina.map(p => (
              <div key={p.id} className="product-row">
                <div className="product-left">
                  <button className="btn-delete-item no-print" onClick={() => eliminarProductoCocina(p.id)}>✖</button>
                  <span className="product-name">• {p.nombre}</span>
                </div>
                <span>$ <input type="number" className="notebook-input" value={p.precio} onChange={(e)=>actualizarPrecioCocina(p.id, e.target.value)} /></span>
              </div>
            ))}
          </div>

          <div style={{marginTop:'10px', textAlign:'right', borderTop:'2px solid #ce1414', paddingTop:'5px', background:'white'}}>
            <strong style={{fontSize:'1rem', color:'#000'}}>Total Mandado: ${totalGastosCocina.toLocaleString()}</strong>
            
            {/* BOTÓN MAGICO DE GEMINI */}
            <button 
              className="no-print"
              onClick={consultarMenuIA}
              disabled={cargandoIA}
              style={{
                display: 'block', width: '100%', marginTop: '10px',
                padding: '8px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(45deg, #7B1FA2, #0288D1)',
                color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem'
              }}
            >
              {cargandoIA ? "🪄 Gemini está pensando..." : "✨ Sugerir Menús con IA"}
            </button>
            
            <button onClick={resetearCocina} style={{display:'block', width:'100%', marginTop:'5px', fontSize:'0.6rem', color:'#999', cursor:'pointer', background:'none', border:'none'}}>🔄 Reset Precios Lunes</button>
          </div>

          {/* RESPUESTA DE GEMINI */}
          {menuSugerido && (
            <div style={{
              marginTop: '15px', padding: '15px', background: '#F3F9FE',
              borderRadius: '10px', borderLeft: '5px solid #0288D1',
              fontFamily: 'Segoe UI', fontSize: '0.85rem', lineHeight: '1.4',
              color: '#333', whiteSpace: 'pre-wrap'
            }}>
              <h4 style={{color: '#0288D1', marginBottom: '8px'}}>🌟 Ideas de Menú:</h4>
              {menuSugerido}
              <button onClick={() => setMenuSugerido("")} style={{marginTop: '10px', color: '#999', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem'}}>Cerrar sugerencias</button>
            </div>
          )}
        </div>

        {/* TABLA HISTORIAL */}
        <div className="card table-scroll" style={{padding:'0'}}>
          <div style={{padding:'20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3 style={{color:'#0277BD'}}>Historial de Pagos</h3>
            <input placeholder="Buscar alumno..." value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} style={{padding:'8px', borderRadius:'8px', border:'1px solid #ddd'}} />
          </div>
          <table>
            <thead>
              <tr>
                <th style={{textAlign:'left', paddingLeft:'20px'}}>Alumno</th>
                <th>Nivel</th>
                <th>Monto</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map(p => (
                <tr key={p.id}>
                  <td style={{textAlign:'left', paddingLeft:'20px', fontWeight:'bold'}}>{p.tutor}</td>
                  <td>
                    <span className={`badge badge-${p.nivel.toLowerCase()}`}>
                      {p.nivel}
                    </span>
                  </td>
                  <td style={{fontWeight:'bold', color:'#0277BD'}}>${p.monto.toLocaleString()}</td>
                  <td style={{fontSize:'0.8rem', color:'#666'}}>{obtenerFechaVencimiento(p.fecha, p.tipo)}</td>
                  <td style={{color: calcularEstadoPago(p.fecha, p.tipo).includes('⚠️') ? '#ce1414' : '#2E7D32', fontWeight:'bold'}}>
                    {calcularEstadoPago(p.fecha, p.tipo)}
                    <div style={{fontSize:'0.6rem', fontWeight:'normal', opacity:0.6}}>Último: {formatearFecha(p.fecha)}</div>
                  </td>
                  <td className="no-print">
                    <button onClick={()=>eliminarRegistroPago(p.id)} style={{border:'none', background:'none', cursor:'pointer'}}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;