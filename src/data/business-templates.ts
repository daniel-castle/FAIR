export type InputType = "text" | "textarea" | "number" | "currency" | "time" | "hours" | "boolean" | "select" | "multi-select" | "location" | "service-area" | "url" | "phone" | "email" | "percentage" | "duration" | "date" | "list" | "tags";
export type TemplateField = {
  key: string; label: string; scope: "business" | "offering"; type: InputType;
  section: string; help?: string; placeholder?: string; unit?: string;
  options?: string[]; required?: boolean; recommended?: boolean; aliases?: string[];
  offeringTypes?: string[];
};
export type BusinessTemplate = { id: string; label: string; description: string; fields: TemplateField[] };
const f = (key: string, label: string, type: InputType, section: string, extra: Partial<TemplateField> = {}): TemplateField => ({ key, label, type, section, scope: "business", ...extra });
const basics = [
  f("description", "Business description", "textarea", "Business Basics", { help: "Describe what your business offers in 1–3 sentences.", recommended: true }),
  f("location", "Location", "location", "Business Basics", { aliases: ["locations"], help: "Add your street address, city, state/region, and postal code. No map lookup is needed.", recommended: true }),
  f("phone", "Phone", "phone", "Business Basics", { placeholder: "(209) 555-0100", recommended: true }),
  f("website", "Website", "url", "Business Basics", { placeholder: "https://example.com" }),
  f("contact_email", "Contact email", "email", "Business Basics", { placeholder: "hello@example.com" }),
];
const hours = f("hours", "Weekly hours", "hours", "Hours & Availability", { aliases: ["operating_hours"], recommended: true, help: "Set each day as open or closed. Closing earlier than opening means the following day." });
const area = f("service_area", "Service area", "service-area", "Business Basics", { aliases: ["locations_service_area"], recommended: true, help: "Where can customers receive this service? Add cities, ZIP codes, or regions and an optional radius." });
const specialties = f("specialties", "Specialties", "tags", "Specialties", { recommended: true, help: "What products, services, or capabilities should FAIR associate strongly with your business?" });
const bool = (key: string, label: string, section = "Hours & Availability") => f(key, label, "boolean", section);
const tags = (key: string, label: string, extra: Partial<TemplateField> = {}) => f(key, label, "tags", "Details", { help: "Add each item separately, then select Add item.", ...extra });
const policy = (key: string, label: string, extra: Partial<TemplateField> = {}) => f(key, label, "textarea", "Policies", { help: "Summarize what customers should know.", ...extra });
const appointments = f("appointments", "Appointments", "select", "Hours & Availability", { options: ["Required", "Optional", "Walk-ins only"], recommended: true });
const warranty = policy("warranty", "Warranty", { section: "Details", help: "Enter the coverage period or short warranty description customers should know." });
const pricingModel = f("pricing_model", "Pricing model", "select", "Pricing", { options: ["Flat rate", "Hourly", "Estimate", "Quote required"], help: "How do you calculate the charge for this service?" });
const commonOffering = [
  f("category", "Category", "text", "Basic Information", { recommended: true, placeholder: "e.g. Repairs, Haircuts, Electronics" }),
  f("price", "Price", "currency", "Pricing", { recommended: true, help: "Choose fixed, starting at, range, quote required, or free. Amounts use USD." }),
  f("availability", "Availability", "select", "Availability", { recommended: true, options: ["Available", "Limited availability", "Unavailable", "Seasonal", "By appointment", "In stock", "Out of stock"] }),
];
function template(id: string, label: string, description: string, business: TemplateField[], offering: TemplateField[]): BusinessTemplate {
  return { id, label, description, fields: [...basics, hours, ...business, ...[...commonOffering, ...offering].map(field => ({ ...field, scope: "offering" as const }))] };
}
export const businessTemplates: BusinessTemplate[] = [
  template("restaurant", "Restaurant / Food Truck", "Menus, dietary details, and ways to order.", [
    tags("cuisine", "Cuisine", { section: "Specialties", recommended: true }), area,
    f("service_options", "Service options", "multi-select", "Hours & Availability", { options: ["Dine-in", "Takeout", "Delivery", "Catering"] }),
    ...["Dine-in", "Takeout", "Delivery", "Catering"].map(label => bool(label.toLowerCase().replace("-", "_"), `${label} available`)),
    tags("dietary_options", "Dietary options", { section: "Specialties" }),
    f("ordering_url", "Ordering link", "url", "Business Basics", { aliases: ["ordering_links"], placeholder: "https://example.com/order" }), specialties,
  ], [
    tags("dietary_options", "Dietary tags"), tags("ingredients", "Key ingredients / features"),
    f("available_hours", "Available days & times", "hours", "Availability", { help: "When can customers order this item? Overnight closing times are supported." }),
  ]),
  template("contractor", "Contractor / Home Services", "Service coverage, credentials, and project details.", [
    area, bool("emergency_service", "Emergency service available"), f("licenses", "License number", "text", "Policies"),
    bool("insurance", "Insured", "Policies"), bool("financing", "Financing available", "Policies"),
    f("years_in_business", "Years in business", "number", "Business Basics", { unit: "years" }),
  ], [pricingModel, warranty, tags("materials_brands_used", "Materials / brands"), area, bool("emergency_service", "Emergency service available", "Availability"), bool("financing", "Financing available", "Pricing")]),
  template("auto", "Auto / Mechanic", "Repair services and vehicle expertise.", [
    bool("towing", "Towing available"), appointments, tags("certifications", "Certifications", { section: "Policies", recommended: true }), tags("supported_makes", "Supported makes", { section: "Specialties" }),
  ], [pricingModel, f("labor_rate", "Labor rate", "currency", "Pricing", { unit: "per hour", offeringTypes: ["service"] }), warranty, bool("appointment_required", "Appointment required", "Availability"), tags("makes_models_supported", "Supported vehicles")]),
  template("barber", "Barber / Salon", "Services, appointments, and your team.", [appointments, bool("walk_ins", "Walk-ins accepted"), specialties, tags("staff_barber_profiles", "Team members", { section: "Specialties" })], [
    f("duration", "Duration", "duration", "Details", { unit: "minutes", recommended: true }), tags("stylist_barber", "Stylist / barber"), tags("specialties", "Specialties"),
  ]),
  template("nail", "Nail Salon", "Treatments, products, and care policies.", [appointments, bool("walk_ins", "Walk-ins accepted"), policy("sanitation_policy_information", "Sanitation & policies", { recommended: true }), specialties], [
    f("duration", "Duration", "duration", "Details", { unit: "minutes" }), tags("products_used", "Products / materials"), tags("specialties", "Specialties"),
  ]),
  template("retail", "Retail / Product Business", "Product specifications and purchase policies.", [policy("shipping", "Shipping"), policy("returns", "Return policy", { recommended: true })], [
    f("sku", "SKU", "text", "Basic Information", { placeholder: "Your product identifier", offeringTypes: ["product", "menu_item"] }),
    policy("specs", "Specifications", { section: "Details" }), warranty, tags("compatibility", "Compatibility"), bool("shipping_eligible", "Eligible for shipping", "Availability"), policy("returns", "Return policy"),
  ]),
  template("generic", "Generic Service Business", "A flexible starting point for any business.", [area, policy("policies", "Policies"), specialties], [pricingModel, warranty]),
];
export function offeringFields(template: BusinessTemplate, type: string) {
  return template.fields.filter(f => f.scope === "offering" && (!f.offeringTypes || f.offeringTypes.includes(type)));
}
export function findTemplate(id: string) { return businessTemplates.find(t => t.id === id) ?? businessTemplates[businessTemplates.length - 1]; }
