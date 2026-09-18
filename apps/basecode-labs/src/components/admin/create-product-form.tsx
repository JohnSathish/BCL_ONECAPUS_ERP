'use client';

export function CreateProductForm() {
  return (
    <form
      className="bcl-card mt-6 grid gap-3 p-5 md:grid-cols-2"
      action={async (formData) => {
        await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.get('name'),
            code: formData.get('code'),
            category: formData.get('category'),
            description: formData.get('description'),
            features: String(formData.get('features') ?? '')
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
          }),
        });
        window.location.reload();
      }}
    >
      <input required name="name" placeholder="Product name" className="bcl-input" />
      <input required name="code" placeholder="Code e.g. ONC" className="bcl-input" />
      <select name="category" className="bcl-input">
        {[
          'ERP',
          'Website',
          'Mobile App',
          'Business Software',
          'SaaS',
          'Desktop Software',
          'API',
          'Hosting',
          'Service',
        ].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <textarea name="description" placeholder="Description" className="bcl-input md:col-span-2" />
      <textarea
        name="features"
        placeholder="One feature per line"
        className="bcl-input min-h-[100px] md:col-span-2"
      />
      <button className="bcl-btn bcl-btn-primary">Add product</button>
    </form>
  );
}
