/* Independent input and navigation contracts. No network dependencies. */
(function (root) {
  'use strict';
  const tabs = ['overview','designs','materials','requests','photos','schedule','estimates','settings'];
  const core = {
    tabs,
    language: value => value === 'en' ? 'en' : 'ko',
    logoError(name, size, bytes) {
      if (!/\.png$/i.test(name)) return 'pngOnly';
      if (size > 1048576) return 'logoLarge';
      const png = [137,80,78,71,13,10,26,10];
      return png.every((byte,i) => bytes[i] === byte) ? '' : 'invalidPng';
    },
    drawingAllowed: name => /\.(skp|pdf|dwg)$/i.test(name),
    split: value => Math.max(0, Math.min(100, Number(value) || 0)),
    monthCells(year, month) {
      const before = new Date(year,month,1).getDay();
      const length = new Date(year,month+1,0).getDate();
      const cells = Array(before).fill(null).concat(Array.from({length},(_,i)=>i+1));
      while(cells.length % 7) cells.push(null);
      return cells;
    },
    parseRoute(hash) {
      const [pathname,search=''] = (hash || '#/pm/projects').split('?');
      const a = pathname.replace(/^#\//,'').split('/');
      const selectedProject = new URLSearchParams(search).get('project');
      const [role,page,project,tab,item] = a;
      if (!['pm','customer','field'].includes(role)) return null;
      const pages = role === 'pm' ? ['projects','customers','calendar','history','notifications','settings','preferences'] : role === 'customer' ? ['projects','notifications','preferences'] : ['photos','notifications','preferences'];
      if(role === 'pm' && ['customers','history'].includes(page) && a.length === 3 && project) return {role,page,item:project};
      if(a.length === 2 && pages.includes(page)) return {role,page,...(role==='field'&&page==='photos'&&selectedProject?{project:selectedProject}:{})};
      if(role === 'field' && page === 'photos' && a.length === 3 && project) return {role,page,item:project};
      if(role !== 'field' && page === 'project' && a.length >= 4 && a.length <= 5 && project && tabs.includes(tab)) {
        if(role === 'customer' && tab === 'settings') return null;
        if(item && ['overview','settings'].includes(tab)) return null;
        return {role,page,project,tab,...(item ? {item} : {})};
      }
      return null;
    },
    escape: value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else root.InteriorCore = core;
})(typeof window !== 'undefined' ? window : globalThis);
