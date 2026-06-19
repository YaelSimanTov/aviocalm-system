const processCalibration = (currentHeartRate, historicalBaseline) => {
    
    // Prevent zero division/errors if watch isn't connected yet
    if (currentHeartRate === 0) {
        return {
            event: "CALIBRATION_SETUP",
            payload: { 
                durationSeconds: 180, 
                startMessage: "Welcome to AvioCalm. The system is now synchronizing your personal metrics. Take a few minutes to relax and enjoy the view.",
                endMessage: "Synchronization completed successfully. We will now move on to a short tutorial, and then we are ready to take off."
            }
        };
    }

    // Check if HR is within 10% of the historical baseline
    const isRelaxed = currentHeartRate <= (historicalBaseline * 1.1);

    if (isRelaxed) {
        return {
            event: "CALIBRATION_SETUP",
            payload: { 
                durationSeconds: 60, 
                startMessage: "Welcome back! We noticed you're relaxed today. We'll do a quick 60-second sync and get started.",
                endMessage: "Synchronization complete. Moving to a short tutorial before takeoff."
            }
        };
    }

    // Stressed user or initial sessions
    return {
        event: "CALIBRATION_SETUP",
        payload: { 
            durationSeconds: 180, 
            startMessage: "Welcome to AvioCalm. The system is now synchronizing your personal metrics. Take a few minutes to relax and enjoy the view.",
            endMessage: "Synchronization completed successfully. We will now move on to a short tutorial, and then we are ready to take off."
        }
    };
};

module.exports = { processCalibration };