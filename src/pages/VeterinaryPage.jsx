import React from "react";
import VeterinaryManager from "../features/veterinary/VeterinaryManager";


function VeterinaryPage({
  businessId,
  role,
}) {
  return (
    <VeterinaryManager
      businessId={businessId}
      role={role}
    />
  );
}


export default VeterinaryPage;