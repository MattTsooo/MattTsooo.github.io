const runBtn = document.getElementById("runBtn");
const mode = document.getElementById("mode");
const content = document.getElementById("content");
const output = document.getElementById("output");

const BACKEND_URL = "https://jgm-chat.cognitiveservices.azure.com";

runBtn.addEventListener("click", async() => {
    output.textContent = "Running audit...";

    try{
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                mode: mode.value,
                content: content.value
            })
        });
        if(!response.ok){
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        output.textContent = data.result ?? "No result returned";
    } catch(err){
        output.textContent = `Error: ${err.message}`;
    }
});