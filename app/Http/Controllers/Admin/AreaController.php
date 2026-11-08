<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Administração › Catálogo › Áreas (as categorias dos cursos). O endereço da área (slug) não muda
 * ao mudar o nome, para não partir ligações; só se apaga uma área sem cursos.
 */
class AreaController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:100', Rule::unique('categories', 'name')->whereNull('deleted_at')]], [
            'name.unique' => __('Já existe uma área com este nome.'),
        ]);
        $base = Str::slug($data['name']) ?: 'area';
        $slug = $base;
        for ($i = 2; Category::withTrashed()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }
        Category::create(['name' => $data['name'], 'slug' => $slug]);

        return back()->with('status', __('Área “:name” criada.', ['name' => $data['name']]));
    }

    public function update(Request $request, Category $category): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:100', Rule::unique('categories', 'name')->whereNull('deleted_at')->ignore($category->id)]], [
            'name.unique' => __('Já existe uma área com este nome.'),
        ]);
        $category->update(['name' => $data['name']]);

        return back()->with('status', __('Área atualizada.'));
    }

    public function destroy(Category $category): RedirectResponse
    {
        if ($category->courses()->withTrashed()->exists()) {
            return back()->withErrors(['area' => __('Esta área tem cursos. Muda-os de área antes de a apagar.')]);
        }
        $category->delete();

        return back()->with('status', __('Área apagada.'));
    }
}
