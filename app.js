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

document.getElementById("sessionId").value = sessionId;
document.getElementById("exp").value = exp;

// ===== Canvas firma =====
const canvas = document.getElementById("firma");
const ctx = canvas.getContext("2d");
let dibujando = false;

function dibujar(e) {
    if (!dibujando) return;
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "black";
    let x, y;
    if (e.touches) {
        const t = e.touches[0];
        // Corregir cálculo de coordenadas para dispositivos táctiles
        const rect = canvas.getBoundingClientRect();
        x = t.clientX - rect.left;
        y = t.clientY - rect.top;
    }
    else { x = e.offsetX; y = e.offsetY; }

    ctx.lineTo(x,y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x,y);
}

canvas.addEventListener("mousedown", ()=>dibujando=true);
canvas.addEventListener("mouseup", ()=>{ dibujando=false; ctx.beginPath(); });
canvas.addEventListener("mousemove", dibujar);

// Listener de toque: SOLUCIÓN DE COMPATIBILIDAD IOS
// Usamos { passive: false } en touchstart para que e.preventDefault() funcione en Safari/iOS antiguos
try {
    canvas.addEventListener("touchstart", e=>{
        dibujando=true;
        dibujar(e);
        // CLAVE: Bloquea el scroll o zoom inicial del navegador
        e.preventDefault();
    }, { passive: false });
} catch (e) {
    // Fallback para navegadores que no soportan { passive: false }
    canvas.addEventListener("touchstart", e=>{
        dibujando=true;
        dibujar(e);
        e.preventDefault();
    });
}

canvas.addEventListener("touchmove", e=>{dibujar(e); e.preventDefault();});
canvas.addEventListener("touchend", ()=>{dibujando=false; ctx.beginPath();});
document.getElementById("limpiarFirma").addEventListener("click", ()=>ctx.clearRect(0,0,canvas.width,canvas.height));

// ===== Enviar asistencia =====
document.getElementById("asistenciaForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (Math.floor(Date.now()/1000) > exp){ alert("QR expirado"); return; }
    // Corregir verificación de firma vacía
    const isCanvasBlank = !ctx.getImageData(0, 0, canvas.width, canvas.height).data.some(channel => channel !== 0);
    if (isCanvasBlank){ alert("Dibuja tu firma"); return; }

    const data = {
        session_id: sessionId,
        nombre: document.getElementById("nombre").value.trim(),
        correo: document.getElementById("correo").value.trim(),
        empresa: document.getElementById("empresa").value.trim(),
        telefono: document.getElementById("telefono").value.trim()
    };

    try{
        const firmaBase64 = canvas.toDataURL("image/png");
        // Subir firma
        const fileName = `firmas/${data.nombre}_${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
            .from('firmas')
            .upload(fileName, dataURLtoFile(firmaBase64, fileName), { upsert: true });
        if(uploadError) throw uploadError;

        const { publicUrl } = supabase.storage.from('firmas').getPublicUrl(fileName);
        data.firma_url = publicUrl;

        // Insertar en tabla
        const { error: insertError } = await supabase.from('asistencias').insert([data]);
        if(insertError) throw insertError;

        document.getElementById("asistenciaForm").reset();
        ctx.clearRect(0,0,canvas.width,canvas.height);
        alert("Asistencia registrada correctamente.");
    } catch(e){
        console.error(e);
        alert("Error al registrar asistencia");
    }
});

// Convierte base64 a File
function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
}