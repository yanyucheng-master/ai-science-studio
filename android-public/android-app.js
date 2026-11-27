(() => {
  "use strict";
  const action = (name, value = "") => window.prompt("masterlab-android/" + name, value);
  window.masterLabAndroid = Object.freeze({
    saveMarkdown(name, text) {
      action("export", JSON.stringify({ name, text }));
    },
    back() {
      const dialog = Array.from(document.querySelectorAll("dialog[open]")).pop();
      if (dialog) { dialog.close(); return true; }
      const close = document.querySelector("#apiKeyModal.show #apiKeyModalClose, #physicsPresetDropdown.show");
      if (close) {
        if (close.id === "physicsPresetDropdown") document.querySelector("#physicsPresetToggle").click();
        else close.click();
        return true;
      }
      if (document.querySelector(".immersive-mode")) {
        document.querySelector("#fullscreenButton").click();
        return true;
      }
      return false;
    }
  });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "检查安装包更新";
  button.addEventListener("click", () => action("update"));
  document.querySelector(".announcements-toolbar").append(button);
})();
