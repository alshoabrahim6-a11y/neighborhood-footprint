// ============================================================================
// AboutPage.jsx
// ----------------------------------------------------------------------------
// The "About" tab (visible to everyone, not just admins): explains the
// project idea and how it works step by step. Static content with no
// server request — meant to help any visitor (or the evaluation committee)
// understand the project quickly as soon as they open the site.
// ============================================================================

const STEPS = [
  {
    icon: '📸',
    title: 'Capture the Report',
    text: 'A user takes a photo of a pollution source they see in their neighborhood (piled-up trash, smoke, polluted water...) and marks its location on the map.',
  },
  {
    icon: '🤖',
    title: 'Automatic AI Classification',
    text: 'An AI model analyzes the photo as soon as it is uploaded and automatically suggests the likely pollution type, with no manual input from the user.',
  },
  {
    icon: '🛡️',
    title: 'Admin Review',
    text: 'Every report first goes through the admin team for verification before being published — this ensures the accuracy of the data shown to everyone.',
  },
  {
    icon: '🗺️',
    title: 'Appearing on the Map',
    text: 'Once approved, the report immediately appears on an interactive heatmap showing the most polluted areas of the city.',
  },
  {
    icon: '🏆',
    title: 'Eco Points for Every Neighborhood',
    text: 'Every neighborhood has "eco points" that drop as approved reports accumulate, and gradually rise over time without new reports — encouraging residents to keep their neighborhood clean.',
  },
  {
    icon: '📊',
    title: 'Automatic Periodic Reports',
    text: 'The system automatically generates a weekly report summarizing the number of reports and their distribution by neighborhood and pollution type, to track the environmental situation over time.',
  },
];

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-hero fade-in-item">
        <h2>About the Project</h2>
        <p className="about-intro">
          <strong>Neighborhood Footprint</strong> is a citizen-science platform for monitoring
          environmental pollution in residential neighborhoods. The core idea is that any resident
          can report any pollution source they see in their neighborhood just by taking a photo, turning
          that report automatically into useful data that helps everyone track their city's
          environmental situation without needing costly field surveys.
        </p>
      </div>

      <h3 className="about-steps-title fade-in-item" style={{ '--i': 1 }}>
        How does the system work?
      </h3>

      <div className="about-steps">
        {STEPS.map((step, index) => (
          <div key={step.title} className="about-step-card fade-in-item" style={{ '--i': index + 2 }}>
            <span className="about-step-icon">{step.icon}</span>
            <div>
              <h4>{step.title}</h4>
              <p>{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
