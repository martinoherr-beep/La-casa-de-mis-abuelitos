// 1. Importamos las funciones necesarias
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // <-- Falta esta línea

const firebaseConfig = {
  apiKey: "AIzaSyADqrxIS9tve2tz3ZAYkwNk9BxzH4ETcwc",
  authDomain: "guarderia-abuelitos.firebaseapp.com",
  projectId: "guarderia-abuelitos",
  storageBucket: "guarderia-abuelitos.firebasestorage.app",
  messagingSenderId: "165444825879",
  appId: "1:165444825879:web:9788aed5531f122c4b3d52"
};

// 2. Inicializamos la App de Firebase
const app = initializeApp(firebaseConfig);

// 3. Exportamos la base de datos para usarla en toda la aplicación
export const db = getFirestore(app); // <-- Esto es lo que soluciona el error