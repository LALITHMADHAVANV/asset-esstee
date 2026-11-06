'use client';
import { DEPARTMENT_NAVIGATION, NavigationHref } from '@/lib/departmentNavigation';

export function DepartmentNavigationPicker({ value = [], onChange }: { value?: NavigationHref[]; onChange: (value: NavigationHref[]) => void }) {
  return <section className="space-y-3 border-t border-slate-200 pt-4">
    <h4 className="font-bold text-sm text-slate-800">Navigation visibility</h4>
      <p className="text-xs text-slate-500">{value.length} selected. Only checked menu items appear for this department’s logins, on desktop and phone. Existing role permissions still apply.</p>
      {[...new Set(DEPARTMENT_NAVIGATION.map(item => item.group))].map(group => <fieldset key={group} className="space-y-2">
        <legend className="font-semibold text-slate-600 mb-2">{group}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{DEPARTMENT_NAVIGATION.filter(item => item.group === group).map(item => <label key={item.href} className={`flex items-center gap-2 min-h-11 rounded-lg p-2.5 border cursor-pointer ${value.includes(item.href) ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700'}`}>
          <input type="checkbox" checked={value.includes(item.href)} onChange={event => onChange(event.target.checked ? [...value, item.href] : value.filter(href => href !== item.href))} className="accent-emerald-600 w-4 h-4 shrink-0" />{item.label}
        </label>)}</div>
      </fieldset>)}
  </section>;
}
