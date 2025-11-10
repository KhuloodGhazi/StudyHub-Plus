import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import DatePicker from "react-datepicker";
import { useAuth } from "../contexts/AuthContext";
import "react-datepicker/dist/react-datepicker.css";

Modal.setAppElement("#root");

export default function ChallengeModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}) {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState("");
  const [level, setLevel] = useState("Easy");
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [maxParticipants, setMaxParticipants] = useState<number>(1);
  const [errors, setErrors] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setTasks(initialData.tasks || initialData.requirements || []);
      setLevel(initialData.level || "Easy");
      setStartDate(
        initialData.start_date ? new Date(initialData.start_date) : new Date()
      );
      setEndDate(initialData.end_date ? new Date(initialData.end_date) : null);
      setMaxParticipants(initialData.max_participants ?? 1);
    } else {
      setTitle("");
      setDescription("");
      setTasks([]);
      setLevel("Easy");
      setStartDate(new Date());
      setEndDate(null);
      setMaxParticipants(1);
    }
  }, [initialData, isOpen]);

  const validate = () => {
    if (!title.trim()) return "Title is required";
    if (!description.trim()) return "Description is required";
    if (!maxParticipants || maxParticipants < 1)
      return "Max participants must be ≥ 1";
    if (startDate && endDate && endDate < startDate)
      return "End date must be after start date";
    return null;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) return setErrors(err);

    const cleanTasks = tasks.map((t) => t.trim()).filter((t) => t.length > 0);

    const data = {
      title,
      description,
      level,
      start_date: startDate ? startDate.toISOString().split("T")[0] : null,
      end_date: endDate ? endDate.toISOString().split("T")[0] : null,
      max_participants: maxParticipants,
      tasks: cleanTasks,
      creator_name:
        user?.name || localStorage.getItem("username") || "Guest",
      creator_id:
        (user as any)?.id ||
        Number(localStorage.getItem("user_id")) ||
        0,
    };

    onSave(data);
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, newTask.trim()]);
    setNewTask("");
  };

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="challenge-modal"
      overlayClassName="challenge-overlay"
    >
      <h2 style={{ textAlign: "center", color: "#001b44", marginBottom: 10 }}>
        {initialData ? "Edit Challenge" : "Create New Challenge"}
      </h2>
      {errors && <p style={{ color: "#e74c3c", marginBottom: 10 }}>{errors}</p>}

      <form onSubmit={handleSave}>
        <div className="form-group">
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Challenge title"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the challenge"
          />
        </div>

        <div className="form-group">
          <label>Tasks</label>
          <div className="requirements-input">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a new task..."
            />
            <button type="button" onClick={addTask}>
              + Add
            </button>
          </div>
          <ul className="requirements-list">
            {tasks.map((task, i) => (
              <li key={i}>
                {task}
                <button
                  type="button"
                  onClick={() => removeTask(i)}
                  className="remove-btn"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="form-group">
          <label>Difficulty Level</label>
          <div className="difficulty-options">
            {["Easy", "Medium", "Hard"].map((option) => (
              <button
                key={option}
                type="button"
                className={`difficulty-btn ${option.toLowerCase()} ${
                  level === option ? "active" : ""
                }`}
                onClick={() => setLevel(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Max Participants</label>
          <input
            type="number"
            min={1}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Start Date</label>
          <DatePicker
            selected={startDate}
            onChange={(d) => setStartDate(d)}
            className="date-input"
            dateFormat="yyyy-MM-dd"
          />
        </div>

        <div className="form-group">
          <label>End Date</label>
          <DatePicker
            selected={endDate}
            onChange={(d) => setEndDate(d)}
            className="date-input"
            dateFormat="yyyy-MM-dd"
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={`save-btn ${level.toLowerCase()}`}>
            {initialData ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
