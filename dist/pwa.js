'use strict';
(function(){
  if(window.__QIAN_NATIVE__===true)return;
  const $=id=>document.getElementById(id);
  $('previewClose').onclick=()=>{const slider=$('previewAngle');slider.value='0';slider.dispatchEvent(new Event('input',{bubbles:true}));};
  $('previewOpen').onclick=()=>{const slider=$('previewAngle');slider.value='180';slider.dispatchEvent(new Event('input',{bubbles:true}));};
  $('showTestTools').onclick=()=>{$('previewTools').open=!$('previewTools').open;if($('previewTools').open)$('previewTools').scrollIntoView({behavior:'smooth',block:'center'});};
  if(new URLSearchParams(location.search).get('launch')==='outer')$('previewLaunchOuter').click();
  const supported=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
  const status=$('webInstallStatus');
  if(!supported){status.textContent='本地预览 · 安装与离线体验需要 HTTPS 测试链接。';return;}
  status.textContent='网页测试版 · iPhone 可在 Safari 分享菜单中添加到主屏幕。';
  if('serviceWorker' in navigator)window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').then(()=>{
      navigator.serviceWorker.ready.then(()=>{status.textContent='网页测试版 · 离线资源已准备；可添加到主屏幕体验。';});
    }).catch(()=>{status.textContent='网页测试版可在线体验；当前浏览器未启用离线缓存。';});
  });
})();
