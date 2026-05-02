(function () {
  const csvInput = document.getElementById("csvInput");
  const uploadBtn = document.getElementById("uploadBtn");
  if (!csvInput || !uploadBtn) return;

  function setStatus(message, isError = false) {
    const statusEl = document.getElementById("csvUploadStatus");
    if (!statusEl) return;
    statusEl.textContent = String(message || "");
    statusEl.style.color = isError ? "#dc2626" : "#16a34a";
  }

  function updateSelectedFile(file) {
    const nameEl = document.getElementById("csvFileName");
    const sizeEl = document.getElementById("csvFileSize");
    if (nameEl) nameEl.textContent = file ? file.name : "No file selected";
    if (sizeEl) sizeEl.textContent = file ? `${(file.size / 1024).toFixed(1)} KB` : "—";
  }

  function isCsvFile(file) {
    if (!file) return false;
    if (file.type === "text/csv" || file.type === "application/vnd.ms-excel") return true;
    return /\.csv$/i.test(file.name || "");
  }

  function validateSelection(file) {
    if (!file) {
      setStatus("Please select a CSV file", true);
      uploadBtn.disabled = true;
      return false;
    }
    if (!isCsvFile(file)) {
      setStatus("Only .csv files are supported", true);
      uploadBtn.disabled = true;
      return false;
    }
    setStatus("CSV selected");
    uploadBtn.disabled = false;
    return true;
  }

  csvInput.addEventListener("change", () => {
    const file = csvInput.files && csvInput.files[0] ? csvInput.files[0] : null;
    updateSelectedFile(file);
    validateSelection(file);
  });

  uploadBtn.addEventListener("click", async () => {
    const file = csvInput.files && csvInput.files[0] ? csvInput.files[0] : null;
    if (!validateSelection(file)) return;
    const formData = new FormData();
    formData.append("csvfile", file);

    const runImport = async () => {
      setStatus("Importing...");
      const hdrs = {};
      if (typeof window.getAdminCsrfToken === "function") {
        hdrs["X-CSRF-Token"] = await window.getAdminCsrfToken();
      }
      const res = await fetch("/api/admin/upload-csv", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: hdrs
      });
      if (res.ok) {
        setStatus("Import successful");
        window.AdminUI?.toastSuccess("Action completed successfully");
      } else {
        setStatus("Import failed", true);
        window.AdminUI?.toastError("Something went wrong");
      }
    };

    try {
      if (window.AdminUI && window.AdminUI.withLoading) {
        await window.AdminUI.withLoading(uploadBtn, runImport, "Importing...");
      } else {
        uploadBtn.disabled = true;
        uploadBtn.textContent = "Importing...";
        await runImport();
      }
    } catch (err) {
      console.error("CSV upload error:", err);
      setStatus("Network error during import", true);
      window.AdminUI?.toastError("Something went wrong");
    } finally {
      uploadBtn.disabled = !csvInput.files || !csvInput.files[0];
      if (!window.AdminUI || !window.AdminUI.withLoading) {
        uploadBtn.textContent = "Import CSV";
      }
    }
  });
})();
