
function toggleQuickActions() {
  const panel = document.getElementById('qaPanel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
// إغلاق عند النقر خارج
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('v220LockedBtns');
  const panel = document.getElementById('qaPanel');
  if (wrap && panel && !wrap.contains(e.target)) {
    panel.style.display = 'none';
  }
});
