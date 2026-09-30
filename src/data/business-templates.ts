export type TemplateField = { key: string; label: string; scope: "business" | "offering" };
export type BusinessTemplate = { id: string; label: string; description: string; fields: TemplateField[] };
const fields = (labels: string, scope: TemplateField["scope"]): TemplateField[] => labels.split("|").map(label => ({ key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_$/, ""), label, scope }));
const template = (id: string, label: string, description: string, business: string, offering: string): BusinessTemplate => ({ id, label, description, fields: [...fields(business, "business"), ...fields(offering, "offering")] });
export const businessTemplates = [
  template("restaurant", "Restaurant / Food Truck", "Menus, dietary details, and ways to order.", "Locations|Hours|Cuisine|Delivery/takeout|Specialties|Ordering links", "Price|Category|Dietary options|Ingredients"),
  template("contractor", "Contractor / Home Services", "Service coverage, credentials, and project details.", "Service area|Licenses|Insurance|Emergency service|Years in business", "Pricing model|Warranty|Materials/brands used|Financing"),
  template("auto", "Auto / Mechanic", "Repair services and vehicle expertise.", "Operating hours|Towing|Certifications|Appointments", "Makes/models supported|Labor rate|Diagnostics|Warranty"),
  template("barber", "Barber / Salon", "Services, appointments, and your team.", "Appointments|Walk-ins|Hours|Specialties|Staff/barber profiles", "Price|Duration|Specialty"),
  template("nail", "Nail Salon", "Treatments, products, and care policies.", "Appointments/walk-ins|Specialties|Products used|Hours|Sanitation/policy information", "Price|Duration|Products used"),
  template("retail", "Retail / Product Business", "Product specifications and purchase policies.", "Locations|Hours|Shipping|Returns", "SKU|Price|Availability|Specs|Category|Warranty|Compatibility"),
  template("generic", "Generic Service Business", "A flexible starting point for any business.", "Locations/service area|Hours|Policies|Specialties|Contact methods", "Price|Category|Description"),
];
