const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
    // Twilio envía los datos en el cuerpo de la petición (req.body)
    const mensaje = req.body.Body; // Ejemplo: "Maria 500"
    
    try {
        // 1. Extraer el monto (buscamos números)
        const montoMatch = mensaje.match(/\d+/);
        const monto = montoMatch ? montoMatch[0] : null;
        
        // 2. Extraer el nombre (quitamos los números y limpiamos espacios)
        const nombreBusqueda = mensaje.replace(/\d+/g, '').trim().toLowerCase();

        if (!monto || !nombreBusqueda) {
            return res.status(200).send("<Response><Message>❌ Error. Envía: Nombre Monto (ej: Pedro 500)</Message></Response>");
        }

        // 3. Buscar al alumno en tu base de datos de Firestore
        const alumnosRef = admin.firestore().collection("alumnos");
        const snapshot = await alumnosRef.get();
        
        let alumnoEncontrado = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            const nombreDoc = data.nombre.toLowerCase();
            // Verificamos si el nombre enviado coincide con alguno de la base de datos
            if (nombreDoc.includes(nombreBusqueda) || nombreBusqueda.includes(nombreDoc)) {
                alumnoEncontrado = data;
            }
        });

        if (alumnoEncontrado) {
            // 4. Registrar el pago en la colección "pagos"
            await admin.firestore().collection("pagos").add({
                tutor: alumnoEncontrado.nombre,
                monto: parseFloat(monto),
                nivel: alumnoEncontrado.nivel,
                tipo: "Semanal", // Por defecto vía WhatsApp
                fecha: new Date().toISOString().split('T')[0]
            });

            res.status(200).send(`<Response><Message>✅ Pago registrado: $${monto} para ${alumnoEncontrado.nombre} (${alumnoEncontrado.nivel}).</Message></Response>`);
        } else {
            res.status(200).send(`<Response><Message>❓ No encontré al alumno "${nombreBusqueda}". Revisa el nombre o dalo de alta en la App.</Message></Response>`);
        }
    } catch (error) {
        console.error("Error en el bot de WhatsApp:", error);
        res.status(200).send("<Response><Message>⚠️ Error técnico al registrar el pago.</Message></Response>");
    }
});