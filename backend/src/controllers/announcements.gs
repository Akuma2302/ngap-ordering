/**
 * Announcements with a target: all | sales | agents | sp:<code>.
 */

function anns_() {
  var props = PropertiesService.getScriptProperties(), list = [];
  try { list = JSON.parse(props.getProperty('ANNOUNCEMENTS') || '[]'); } catch (e) {}
  var old = props.getProperty('ANNOUNCEMENT');           // migrate the single announcement from before
  if (old) {
    try { var o = JSON.parse(old); if (o && o.text) list.unshift({ id: 'AN-' + Date.now(), text: o.text, target: 'all', updatedAt: o.updatedAt }); } catch (e) {}
    props.deleteProperty('ANNOUNCEMENT'); props.setProperty('ANNOUNCEMENTS', JSON.stringify(list));
  }
  return list;
}

function getAnnouncement_(req) {
  var role = req.role === 'agent' ? 'agent' : 'sales', mine = '';
  if (role === 'agent' && req.agent) { try { mine = spCodeByPhone_(agentByCode_(req.agent).sp); } catch (e) {} }
  if (role === 'sales') mine = String(req.sp || '');
  var list = anns_().filter(function (a) {
    return a.target === 'all' || (a.target === 'sales' && role === 'sales') || (a.target === 'agents' && role === 'agent') ||
           (a.target.indexOf('sp:') === 0 && mine && a.target.slice(3).toLowerCase() === mine.toLowerCase());
  });
  return { ok: true, announcements: list, announcement: list[0] || null };
}

function adminListAnnouncements_(req) { checkAdmin_(req.password); return { ok: true, announcements: anns_() }; }

function adminAddAnnouncement_(req) {
  checkAdmin_(req.password);
  var text = String(req.text || '').trim().slice(0, 500); if (!text) throw new Error('Tulis pengumuman dahulu.');
  var target = String(req.target || 'all');
  if (!/^(all|sales|agents|sp:.+)$/.test(target)) throw new Error('Sasaran tidak sah.');
  var list = anns_(); list.unshift({ id: 'AN-' + Date.now(), text: text, target: target, updatedAt: stamp_() });
  list = list.slice(0, 20);
  PropertiesService.getScriptProperties().setProperty('ANNOUNCEMENTS', JSON.stringify(list));
  log_('Admin', 'Pengumuman', target, text.slice(0, 80));
  return { ok: true, announcements: list };
}

function adminDeleteAnnouncement_(req) {
  checkAdmin_(req.password);
  var list = anns_().filter(function (a) { return a.id !== req.id; });
  PropertiesService.getScriptProperties().setProperty('ANNOUNCEMENTS', JSON.stringify(list));
  log_('Admin', 'Padam pengumuman', req.id, '');
  return { ok: true, announcements: list };
}

// kept for older admin pages
function adminSetAnnouncement_(req) {
  if (String(req.text || '').trim()) return adminAddAnnouncement_({ password: req.password, text: req.text, target: 'all' });
  checkAdmin_(req.password); PropertiesService.getScriptProperties().setProperty('ANNOUNCEMENTS', '[]'); return { ok: true, announcements: [] };
}
