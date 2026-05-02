// =============================
// 🎂 AGE CALCULATOR
// =============================
function calcFullAge(){

  const dob = document.getElementById("dob")?.value;
  const toDate = document.getElementById("toDate")?.value;
  const resultBox = document.getElementById("result");

  if(!dob || !toDate){
    if(resultBox) resultBox.innerHTML = "⚠️ Please select both dates";
    return;
  }

  const d1 = new Date(dob);
  const d2 = new Date(toDate);

  if(d2 < d1){
    resultBox.innerHTML = "❌ To Date must be after DOB";
    return;
  }

  let years = d2.getFullYear() - d1.getFullYear();
  let months = d2.getMonth() - d1.getMonth();
  let days = d2.getDate() - d1.getDate();

  if(days < 0){
    months--;
    const prevMonth = new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
    days += prevMonth;
  }

  if(months < 0){
    years--;
    months += 12;
  }

  resultBox.innerHTML = `
    <div class="result-box">
      <p><b>Age:</b> ${years} Years ${months} Months ${days} Days</p>
    </div>
  `;
}


// =============================
// 📷 IMAGE EDITOR PRO
// =============================

// 👉 Only run if image page exists
if(document.getElementById("imageInput")){

  let originalImage = null;

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  // 📥 LOAD
  document.getElementById("imageInput").addEventListener("change", function(e){

    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();

    reader.onload = function(ev){

      const img = new Image();

      img.onload = function(){

        originalImage = img;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img,0,0);

        const sizeKB = (file.size / 1024).toFixed(2);

        const infoBox = document.getElementById("imageInfo");
        if(infoBox){
          infoBox.innerHTML = `
            📊 Width: ${img.width}px | Height: ${img.height}px | Size: ${sizeKB} KB
          `;
        }

        document.getElementById("width").value = img.width;
        document.getElementById("height").value = img.height;

        const btn = document.getElementById("downloadBtn");
        if(btn) btn.style.display = "inline-block";
      }

      img.src = ev.target.result;
    }

    reader.readAsDataURL(file);
  });


  // 🔄 PROCESS
  window.processImage = function(){

    if(!originalImage) return;

    let width = parseInt(document.getElementById("width").value);
    let height = parseInt(document.getElementById("height").value);
    const percent = parseInt(document.getElementById("percent").value);

    if(percent){
      width = originalImage.width * percent / 100;
      height = originalImage.height * percent / 100;
    }

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(originalImage,0,0,width,height);
  }


  // 🔄 ROTATE
  window.rotateImage = function(){

    const tempCanvas = document.createElement("canvas");
    const tctx = tempCanvas.getContext("2d");

    tempCanvas.width = canvas.height;
    tempCanvas.height = canvas.width;

    tctx.translate(tempCanvas.width/2, tempCanvas.height/2);
    tctx.rotate(Math.PI/2);
    tctx.drawImage(canvas, -canvas.width/2, -canvas.height/2);

    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;

    ctx.drawImage(tempCanvas,0,0);
  }


  // ✂️ CROP
  let startX, startY, endX, endY;
  let cropping = false;

  canvas.addEventListener("mousedown", e=>{
    startX = e.offsetX;
    startY = e.offsetY;
    cropping = true;
  });

  canvas.addEventListener("mouseup", e=>{
    if(!cropping) return;

    endX = e.offsetX;
    endY = e.offsetY;

    cropImage();
    cropping = false;
  });

  function cropImage(){

    const width = endX - startX;
    const height = endY - startY;

    if(width <= 0 || height <= 0) return;

    const imageData = ctx.getImageData(startX, startY, width, height);

    canvas.width = width;
    canvas.height = height;

    ctx.putImageData(imageData,0,0);
  }


  // 📥 DOWNLOAD
  window.downloadImage = function(){

    const targetKB = parseInt(document.getElementById("targetSize").value);

    let quality = 0.9;
    let dataURL = canvas.toDataURL("image/jpeg", quality);

    if(targetKB){
      while(dataURL.length/1024 > targetKB && quality > 0.1){
        quality -= 0.05;
        dataURL = canvas.toDataURL("image/jpeg", quality);
      }
    }

    const link = document.createElement("a");
    link.download = "optimized.jpg";
    link.href = dataURL;
    link.click();
  }

}

// =============================
// 🌐 SHARE PAGE
// =============================
function sharePage() {
  const url = window.location.href;
  const title = document.title;

  if (navigator.share) {
    navigator.share({
      title: title,
      url: url
    });
  } else {
    window.open(`https://wa.me/?text=${title} - ${url}`);
  }
}

/* CSP: no inline onclick on share control — wired from template after DOM ready */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("sharePageBtn")?.addEventListener("click", () => sharePage());
});