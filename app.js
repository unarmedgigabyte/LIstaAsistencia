// ====== CONFIGURA ESTO ======
const SUPABASE_URL = "https://kdacskidrbbqbstizekl.supabase.co"; // tu URL de Supabase
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWNza2lkcmJicWJzdGl6ZWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNTQ1NDIsImV4cCI6MjA3NjczMDU0Mn0.SqnbCRbwI4EWYp14VAF8HR5cSmeaF4FNI5bUVOCuD0wM"; // tu anon key
// ============================

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Capturar parámetros QR
function getQueryParams() {
    const params = {};
    window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi,
        (m,key,value) => { params[key] = decodeURIComponent(value); });
    return params;
}
const params = getQueryParams();
const sessionId = params.sessionId;
const exp = parseInt(params.exp || 0);

if (!sessionId || !exp) {
    alert("QR inválido.");
    document.getElementById("asistenciaForm").style.display = "none";
}

// Nota: Asumo que tienes campos ocultos con estos IDs en tu HTML
// document.getElementById("sessionId").value = sessionId;
// document.getElementById("exp").value = exp;

// ===== Canvas firma (Implementación con SignaturePad) =====
const canvas = document.getElementById("signature-pad");

// Función de redimensionamiento (CLAVE para la calidad en dispositivos de alta densidad)
function resizeCanvas() {
    // Guarda los datos antes de redimensionar
    const data = sigPad ? sigPad.toData() : [];
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    // Establece el ancho y alto interno del canvas basado en el tamaño visual (CSS)
    canvas.width = Math.floor(canvas.offsetWidth * ratio);
    canvas.height = Math.floor(canvas.offsetHeight * ratio);

    if (sigPad) {
        const ctx = canvas.getContext("2d");
        ctx.scale(ratio, ratio);
        sigPad.fromData(data); // Restaura la firma
    }
}

// Inicializar SignaturePad (Esta librería es mejor para compatibilidad táctil)
const sigPad = new SignaturePad(canvas, {
    backgroundColor: 'rgb(255,255,255)',
    penColor: 'rgb(0, 0, 0)'
});

resizeCanvas();
window.addEventListener('resize', resizeCanvas); // Adaptación al girar/cambiar tamaño

// Limpiar firma (Asumo el ID del botón es 'clearBtn' del Código 2)
document.getElementById("clearBtn").addEventListener("click", () => {
    sigPad.clear();
});

// Forzar Prevención de Scroll/Zoom en iOS Antiguo (Doble seguridad)
try {
    canvas.addEventListener('touchstart', (e) => {
        if (e.target === canvas) e.preventDefault();
    }, { passive: false });
} catch (e) {
    canvas.addEventListener('touchstart', (e) => {
        if (e.target === canvas) e.preventDefault();
    });
}

// ===== Enviar asistencia (Adaptado para usar SignaturePad) =====
document.getElementById("asistenciaForm").addEventListener("submit", async (e)=>{
    e.preventDefault();

    if (Math.floor(Date.now()/1000) > exp){ alert("QR expirado"); return; }

    // Verificación de firma vacía con SignaturePad
    if (sigPad.isEmpty()){
        alert("Dibuja tu firma");
        return;
    }

    const data = {
        session_id: sessionId,
        nombre: document.getElementById("nombre").value.trim(),
        correo: document.getElementById("correo").value.trim(),
        empresa: document.getElementById("empresa").value.trim(),
        telefono: document.getElementById("telefono").value.trim()
    };

    // Deshabilitar botón y mostrar estado si lo tienes en el HTML
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Registrando...'; }


    try{
        // Obtener Base64 desde SignaturePad
        const firmaBase64 = sigPad.toDataURL("image/png");

        // Subir firma
        const fileName = `firmas/${data.nombre}_${Date.now()}.png`;

        // Usamos fetch/blob para subir a Supabase, que es más moderno y robusto
        const blob = await (await fetch(firmaBase64)).blob();

        const { error: uploadError } = await supabase.storage
            .from('firmas')
            .upload(fileName, blob, { contentType: 'image/png', upsert: true });
        if(uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('firmas').getPublicUrl(fileName);
        data.firma_url = publicUrlData.publicUrl;

        // Insertar en tabla
        const { error: insertError } = await supabase.from('asistencias').insert([data]);
        if(insertError) throw insertError;

        document.getElementById("asistenciaForm").reset();
        sigPad.clear(); // Limpiar con la función de SignaturePad
        alert("✅ Asistencia registrada correctamente.");

    } catch(e){
        console.error(e);
        alert("❌ Error al registrar asistencia");
    } finally {
        // Restaurar botón
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Registrar asistencia'; }
    }
});