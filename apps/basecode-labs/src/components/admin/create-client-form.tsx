'use client';

export function CreateClientForm() {
  return (
    <form
      className="bcl-card mt-6 grid gap-3 p-5 md:grid-cols-3"
      action={async (formData) => {
        await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(formData.entries())),
        });
        window.location.reload();
      }}
    >
      <input required name="organisation" placeholder="Organisation" className="bcl-input" />
      <input name="contactPerson" placeholder="Contact person" className="bcl-input" />
      <input name="email" type="email" placeholder="Email" className="bcl-input" />
      <input name="phone" placeholder="Phone" className="bcl-input" />
      <input name="institutionType" placeholder="Institution type" className="bcl-input" />
      <input name="website" placeholder="Website" className="bcl-input" />
      <button className="bcl-btn bcl-btn-primary">Create client</button>
    </form>
  );
}
