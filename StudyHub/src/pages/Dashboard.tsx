import MainLayout from "../layout/MainLayout";
import "../css/Dashboard.css";
import study_illustration from "../assets/images/study_illustration.png";
import streak_illustration from "../assets/images/streak_illustration.png";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth(); // ✅ must be inside the component

  return (
    <MainLayout>
      <div className="dashboard-container">
        <div className="top-section">
          <div className="welcome-card">
            <h2>
              Welcome <span>{user ? user.name : "Guest"}</span>
            </h2>
            <img
              src={study_illustration}
              alt="Study Illustration"
              className="welcome-img"
            />
          </div>

          <div className="streak-card">
            <h3>Streak</h3>
            <p>
              <span>3 Days</span>
            </p>
            <img
              src={streak_illustration}
              alt="Streak Runner"
              className="streak-img"
            />
          </div>
        </div>

        <div className="progress-section">
          <div className="card weekly-progress">
            <h3>Weekly Progress</h3>
            <img
              src="/assets/images/chart.png"
              alt="Weekly Progress Chart"
              className="chart-img"
            />
          </div>

          <div className="card overall-progress">
            <h3>Progress Overall</h3>
            <div className="circle">
              <p className="percent">80%</p>
              <p className="text">Complete</p>
            </div>
          </div>

          <div className="card focus-progress">
            <h3>Focus Progress</h3>
            <p className="time">00:00</p>
            <img
              src="/assets/images/plant.png"
              alt="Focus Progress Plant"
              className="plant-img"
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
