console.log("Gemfold: Content script loaded");function n(){const e=document.querySelector("side-navigation-content > .sidenav-with-history-container")||document.querySelector("side-navigation-content > div"),t=document.querySelector(".gems-list-container");if(e&&t){if(document.getElementById("gemfold-root"))return;console.log("Gemfold: Target found, injecting...");const o=document.createElement("div");o.id="gemfold-root",o.innerHTML=`
      <div class="gemfold-header">
        <span class="material-symbols-outlined">folder</span>
        <span>Gemfold Folders</span>
      </div>
      <div class="gemfold-body">
        (Folders will appear here)
      </div>
    `,t.insertAdjacentElement("afterend",o)}}const r=new MutationObserver(e=>{n()});setTimeout(()=>{const e=document.querySelector("body");e&&(r.observe(e,{childList:!0,subtree:!0}),n())},1e3);
