# 🌲 Forest Watch AI: Sumatra Deforestation Detection

![Project Status](https://img.shields.io/badge/Status-Active-success)
![Model](https://img.shields.io/badge/Model-YOLOv11-blue)
![Platform](https://img.shields.io/badge/Platform-Roboflow-purple)
![Deployment](https://img.shields.io/badge/Deployment-Vercel-black)

An AI-powered automated detection system for monitoring active deforestation in Sumatra's tropical rainforests. This project combines computer vision (YOLOv11) with a modern web application (Next.js) to enable accessible, real-time forest monitoring.

🔗 **Live Demo:** [https://forest-watch.itsfarid.com/](https://forest-watch.itsfarid.com/)

---

## 📋 Table of Contents

- [Background](#-background)
- [Tech Stack](#️-tech-stack)
- [Dataset Methodology](#-dataset-methodology)
- [Model Performance](#-model-performance)
- [Web Application](#-web-application)
- [Installation](#-installation)
- [Usage](#-usage)
- [Future Improvements](#-future-improvements)
- [Author](#-author)

---

## 🌍 Background

Deforestation in Sumatra poses a critical environmental challenge. Traditional monitoring methods struggle with:
- Vast geographical coverage requirements
- Difficult terrain accessibility
- Inability to distinguish between active clearing and established plantations

### Project Objectives

1. **Dataset Creation:** Build a standardized pipeline using high-quality satellite imagery
2. **Model Training:** Develop an AI model capable of identifying visual patterns of active deforestation
3. **Public Access:** Provide an accessible web interface for real-time detection and testing

---

## 🛠️ Tech Stack

### AI & Data Pipeline

- **Model:** YOLOv11s (Small) - Optimized for edge/cloud performance
- **Training Platform:** Roboflow - Cloud GPU training infrastructure
- **Data Source:** Google Earth Pro - High-resolution historical imagery
- **Preprocessing:** Roboflow Pipeline - Auto-orient, resize (640×640), augmentation

### Web Application

- **Framework:** Next.js 14 
- **Language:** TypeScript
- **Inference:** Roboflow Inference API
- **Styling:** Tailwind CSS

---

## 🔬 Dataset Methodology

This project employs a **manual, measurement-based approach** to ensure spatial consistency and data quality, unlike randomly scraped internet datasets.

### Data Collection Protocol

**Source:** Google Earth Pro
- High resolution with historical imagery capabilities

**Locations:** Aceh Tamiang, South Tapanuli, Agam
- Known deforestation hotspots in Sumatra

**Eye Altitude:** 1000m - 2000m
- Maintains consistent object scale for model learning

**View Angle:** Top-down (perpendicular)
- Prevents perspective distortion

**Quality Control:** Cloud removal & blur filtering
- Ensures high-quality training data

### Dataset Statistics

```
Total Raw Images:     132
Valid Images (Clean): 122
Annotated Images:     61 (Initial Phase)

Split Ratio:
├─ Train:             70%
├─ Validation:        20%
└─ Test:              10%
```

---

## 📊 Model Performance

The model was trained for **190 epochs** with early stopping to prevent overfitting.

### Evaluation Metrics (Version 5)

- **mAP@50:** 39.4%
- **Precision:** 42.5%
- **Recall:** 47.7%

### Training Analysis

Despite operating in a limited data regime, the model demonstrates:
- **Good convergence:** Steadily decreasing loss values
- **Feature learning:** Successfully identifies deforestation patterns (not random guessing)
- **Stability:** No signs of severe overfitting

> **Note:** Performance metrics reflect initial training phase with 61 annotated images. Results are expected to improve with expanded dataset.

---

## 🚀 Web Application

Built to simulate real-world deployment scenarios with user-friendly features.

### Key Features

- **🖱️ Drag & Drop Interface:** Easy satellite image upload
- **⚡ Real-time Inference:** Detection results in seconds via server actions
- **📊 Confidence Visualization:** Display bounding boxes with confidence scores
- **🔒 Privacy-Focused:** Temporary processing, no permanent storage
- **📱 Responsive Design:** Works across desktop and mobile devices

### Architecture

```
User Upload → Next.js Server Action → Roboflow API → Detection Results → UI Visualization
```

---

## 💻 Installation

### Prerequisites

- Node.js 18+ and npm/yarn
- Roboflow account with API access

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/username/forest-watch-ai.git
   cd forest-watch-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   ROBOFLOW_API_KEY=your_api_key_here
   ROBOFLOW_MODEL_ID=deforestation-detection-ivd96/5
   ROBOFLOW_CONFIDENCE_THRESHOLD=0.5
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open application**
   
   Navigate to `http://localhost:3000` in your browser

---

## 📖 Usage

### For End Users

1. Visit the [live demo](https://forest-watch.itsfarid.com/)
2. Upload a satellite image (JPEG/PNG)
3. Wait for processing (typically 2-5 seconds)
4. View detection results with confidence scores

### For Developers

```typescript
// Example API usage
const response = await fetch('/api/detect', {
  method: 'POST',
  body: formData
});

const results = await response.json();
// Handle detection results
```

---

## 🎯 Future Improvements

- [ ] Expand dataset to 500+ annotated images
- [ ] Implement temporal analysis (change detection over time)
- [ ] Add batch processing for multiple images
- [ ] Integrate with real satellite data feeds
- [ ] Develop alert system for detected deforestation
- [ ] Mobile app development

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Thanks To

- Google Earth Pro for satellite imagery
- Roboflow for training infrastructure

---

## 👨‍💻 Author

**Farid Farhan**

*Developed as part of Artificial Intelligence (AI) Final Semester Project*

---

## 📧 Contact & Support

For questions, suggestions, or collaboration opportunities:
- Create an issue on GitHub
- Visit the live demo at [forest-watch.itsfarid.com](https://forest-watch.itsfarid.com/)

---

**⭐ If you find this project useful, please consider giving it a star!** 

**Thanks**
