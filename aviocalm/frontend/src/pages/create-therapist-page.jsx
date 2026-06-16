import AddTherapistForm from "../components/add-therapist-form/add-therapist-form";

function CreateTherapistPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Create Therapist</h1>
      <AddTherapistForm />
    </div>
  );
}

export default CreateTherapistPage;