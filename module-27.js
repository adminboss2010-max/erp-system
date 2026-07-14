
window.nayefShowLoader = function(msg) {
  const loader = document.getElementById('nayefLoader');
  const msgEl = document.getElementById('nayefLoaderMsg');
  if(msg) msgEl.textContent = msg;
  if(loader) loader.style.display = 'flex';
};
window.nayefHideLoader = function() {
  const loader = document.getElementById('nayefLoader');
  if(loader) loader.style.display = 'none';
};
