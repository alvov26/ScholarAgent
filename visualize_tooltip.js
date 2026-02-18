// Simulation of Tailwind classes and the React component behavior
function TooltipSpan({ children, level = 0 }) {
  // Current style from the file:
  // "paper-tooltip px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[0.9em] font-medium mx-0.5 cursor-help border-b-2 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400 transition-all"
  
  const style = {
    display: 'inline-block',
    padding: '0.125rem 0.375rem',
    backgroundColor: '#eff6ff', // bg-indigo-50 approx
    color: '#4338ca', // text-indigo-700
    borderRadius: '0.375rem',
    fontSize: '0.9em',
    fontWeight: '500',
    margin: '0 0.125rem',
    cursor: 'help',
    borderBottom: '2px solid #c7d2fe', // border-indigo-200
    transition: 'all 0.2s'
  };

  return `<span class="paper-tooltip level-${level}" style="${Object.entries(style).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`).join('; ')}">${children}</span>`;
}

const nestedExample = TooltipSpan({ 
  children: `training ${TooltipSpan({ children: 'objective', level: 1 })}`, 
  level: 0 
});

console.log(nestedExample);
