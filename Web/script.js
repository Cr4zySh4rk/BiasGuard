document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const csvFileInput = document.getElementById('csvFile');
    const fileNameSpan = document.getElementById('fileName');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const dataSection = document.querySelector('.data-section');
    const loadingSection = document.querySelector('.loading-section');
    const statsTableBody = document.getElementById('statsBody');
    
    // Targeting elements
    const genderTarget = document.getElementById('genderTarget');
    const ageTargetType = document.getElementById('ageTargetType');
    const ageRangeInput = document.getElementById('ageRangeInput');
    const ageGroupInput = document.getElementById('ageGroupInput');
    const ageMin = document.getElementById('ageMin');
    const ageMax = document.getElementById('ageMax');
    const ageGroup = document.getElementById('ageGroup');

    // Chart instances
    let ageChart, genderChart, religionChart, locationChart;
    
    // Data storage
    let csvData = [];
    let sensitiveParams = {
        age: { name: 'Age', data: {}, chart: null },
        gender: { name: 'Gender', data: {}, chart: null },
        religion: { name: 'Religion', data: {}, chart: null },
        location: { name: 'Location', data: {}, chart: null }
    };

    // Event Listeners
    csvFileInput.addEventListener('change', handleFileSelect);
    analyzeBtn.addEventListener('click', analyzeData);
    generateReportBtn.addEventListener('click', generatePDFReport);
    ageTargetType.addEventListener('change', toggleAgeInputType);

    // Initialize age input visibility
    toggleAgeInputType();

    function toggleAgeInputType() {
        if (ageTargetType.value === 'range') {
            ageRangeInput.classList.remove('hidden');
            ageGroupInput.classList.add('hidden');
        } else {
            ageRangeInput.classList.add('hidden');
            ageGroupInput.classList.remove('hidden');
        }
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            fileNameSpan.textContent = file.name;
            analyzeBtn.disabled = false;
        } else {
            fileNameSpan.textContent = 'No file chosen';
            analyzeBtn.disabled = true;
        }
    }
    
    async function analyzeData() {
        const file = csvFileInput.files[0];
        if (!file) return;
        
        loadingSection.classList.remove('hidden');
        dataSection.classList.add('hidden');
        
        try {
            const text = await readFileAsText(file);
            csvData = parseCSV(text);
            
            // Get targeting parameters and analyze
            const targeting = getTargetingParameters();
            analyzeSensitiveParameters(targeting);
            
            createCharts();
            populateStatsTable();
            
            loadingSection.classList.add('hidden');
            dataSection.classList.remove('hidden');
        } catch (error) {
            console.error('Error analyzing data:', error);
            loadingSection.classList.add('hidden');
            alert('Error analyzing data. Please check the file format and try again.');
        }
    }
    
    function getTargetingParameters() {
        const gender = genderTarget.value;
        
        let ageMinVal, ageMaxVal;
        if (ageTargetType.value === 'range') {
            ageMinVal = parseInt(ageMin.value) || 0;
            ageMaxVal = parseInt(ageMax.value) || 100;
        } else {
            switch(ageGroup.value) {
                case 'kids':
                    ageMinVal = 0;
                    ageMaxVal = 17;
                    break;
                case 'adults':
                    ageMinVal = 18;
                    ageMaxVal = 64;
                    break;
                case 'seniors':
                    ageMinVal = 65;
                    ageMaxVal = 100;
                    break;
                default:
                    ageMinVal = 0;
                    ageMaxVal = 100;
            }
        }
        
        return {
            gender,
            ageMin: ageMinVal,
            ageMax: ageMaxVal
        };
    }
    
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = error => reject(error);
            reader.readAsText(file);
        });
    }
    
    function parseCSV(text) {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] ? values[index].trim() : '';
                return obj;
            }, {});
        });
    }
    
    function analyzeSensitiveParameters(targeting) {
        Object.keys(sensitiveParams).forEach(key => {
            sensitiveParams[key].data = {};
        });
        
        csvData.forEach(record => {
            // Check if record matches targeting criteria
            const age = parseInt(record.age) || 0;
            const genderMatch = targeting.gender === 'both' || 
                              record.gender.toLowerCase() === targeting.gender;
            const ageMatch = age >= targeting.ageMin && age <= targeting.ageMax;
            
            if (!genderMatch || !ageMatch) return;
            
            // Age analysis
            if (record.age) {
                const ageGroup = Math.floor(age / 10) * 10;
                const ageRange = `${ageGroup}-${ageGroup + 9}`;
                sensitiveParams.age.data[ageRange] = (sensitiveParams.age.data[ageRange] || 0) + 1;
            }
            
            // Gender analysis
            if (record.gender) {
                const gender = record.gender.toLowerCase();
                sensitiveParams.gender.data[gender] = (sensitiveParams.gender.data[gender] || 0) + 1;
            }
            
            // Religion analysis
            if (record.religion) {
                const religion = record.religion.toLowerCase();
                sensitiveParams.religion.data[religion] = (sensitiveParams.religion.data[religion] || 0) + 1;
            }
            
            // Location analysis
            if (record.location) {
                const location = record.location.toLowerCase();
                sensitiveParams.location.data[location] = (sensitiveParams.location.data[location] || 0) + 1;
            }
        });
    }
    
    function createCharts() {
        if (ageChart) ageChart.destroy();
        if (genderChart) genderChart.destroy();
        if (religionChart) religionChart.destroy();
        if (locationChart) locationChart.destroy();
        
        // Age Chart
        const ageCtx = document.getElementById('ageChart').getContext('2d');
        ageChart = new Chart(ageCtx, createBarChartConfig(
            'Age Distribution', 
            Object.keys(sensitiveParams.age.data), 
            Object.values(sensitiveParams.age.data),
            'rgba(54, 162, 235, 0.7)'
        ));
        
        // Gender Chart
        const genderCtx = document.getElementById('genderChart').getContext('2d');
        genderChart = new Chart(genderCtx, createPieChartConfig(
            'Gender Distribution', 
            Object.keys(sensitiveParams.gender.data), 
            Object.values(sensitiveParams.gender.data)
        ));
        
        // Religion Chart
        const religionCtx = document.getElementById('religionChart').getContext('2d');
        religionChart = new Chart(religionCtx, createPieChartConfig(
            'Religion Distribution', 
            Object.keys(sensitiveParams.religion.data), 
            Object.values(sensitiveParams.religion.data)
        ));
        
        // Location Chart
        const locationCtx = document.getElementById('locationChart').getContext('2d');
        locationChart = new Chart(locationCtx, createBarChartConfig(
            'Location Distribution', 
            Object.keys(sensitiveParams.location.data), 
            Object.values(sensitiveParams.location.data),
            'rgba(75, 192, 192, 0.7)'
        ));
    }
    
    function createBarChartConfig(title, labels, data, backgroundColor) {
        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: data,
                    backgroundColor: backgroundColor,
                    borderColor: backgroundColor.replace('0.7', '1'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 16
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        };
    }
    
    function createPieChartConfig(title, labels, data) {
        const backgroundColors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)'
        ];
        
        return {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 16
                        }
                    }
                }
            }
        };
    }
    
    function populateStatsTable() {
        statsTableBody.innerHTML = '';
        
        Object.keys(sensitiveParams).forEach(param => {
            const paramData = sensitiveParams[param];
            const total = Object.values(paramData.data).reduce((sum, count) => sum + count, 0);
            
            Object.keys(paramData.data).forEach((key, index) => {
                const count = paramData.data[key];
                const percentage = ((count / total) * 100).toFixed(1) + '%';
                
                const row = document.createElement('tr');
                
                if (index === 0) {
                    const nameCell = document.createElement('td');
                    nameCell.textContent = paramData.name;
                    nameCell.rowSpan = Object.keys(paramData.data).length;
                    row.appendChild(nameCell);
                }
                
                const keyCell = document.createElement('td');
                keyCell.textContent = key;
                row.appendChild(keyCell);
                
                const countCell = document.createElement('td');
                countCell.textContent = count;
                row.appendChild(countCell);
                
                const percentageCell = document.createElement('td');
                percentageCell.textContent = percentage;
                row.appendChild(percentageCell);
                
                statsTableBody.appendChild(row);
            });
        });
    }
    
    async function generatePDFReport() {
        try {
            loadingSection.classList.remove('hidden');
            
            const { PDFDocument, rgb } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([600, 850]); // Increased height for additional content
            
            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            
            // Title
            page.drawText('Ad Targeting Analytics Report', {
                x: 50,
                y: 800,
                size: 20,
                font: fontBold,
                color: rgb(0, 0, 0)
            });
            
            // Date
            const today = new Date();
            page.drawText(`Generated on: ${today.toLocaleDateString()}`, {
                x: 50,
                y: 770,
                size: 12,
                font: font,
                color: rgb(0, 0, 0)
            });
            
            // Get targeting parameters
            const targeting = getTargetingParameters();
            
            // Targeting Section
            page.drawText('Targeting Parameters:', {
                x: 50,
                y: 730,
                size: 16,
                font: fontBold,
                color: rgb(0, 0, 0)
            });
            
            const genderText = `Gender: ${targeting.gender === 'both' ? 'Male & Female' : targeting.gender}`;
            const ageText = `Age Range: ${targeting.ageMin}-${targeting.ageMax}`;
            
            page.drawText(genderText, {
                x: 50,
                y: 700,
                size: 12,
                font: font,
                color: rgb(0, 0, 0)
            });
            
            page.drawText(ageText, {
                x: 50,
                y: 680,
                size: 12,
                font: font,
                color: rgb(0, 0, 0)
            });
            
            // Compliance Analysis
            const totalRecords = csvData.length;
            const filteredRecords = Object.values(sensitiveParams.age.data).reduce((a,b) => a + b, 0);
            const compliancePercent = ((filteredRecords / totalRecords) * 100).toFixed(1);
            
            page.drawText('Targeting Compliance:', {
                x: 50,
                y: 650,
                size: 16,
                font: fontBold,
                color: rgb(0, 0, 0)
            });
            
            page.drawText(`${filteredRecords} of ${totalRecords} records (${compliancePercent}%) match your targeting criteria`, {
                x: 50,
                y: 620,
                size: 12,
                font: font,
                color: rgb(0, 0, 0)
            });
            
            // Summary Statistics
            let yPos = 580;
            page.drawText('Summary Statistics:', {
                x: 50,
                y: yPos,
                size: 16,
                font: fontBold,
                color: rgb(0, 0, 0)
            });
            
            yPos -= 30;
            
            Object.keys(sensitiveParams).forEach(param => {
                const paramData = sensitiveParams[param];
                const total = Object.values(paramData.data).reduce((sum, count) => sum + count, 0);
                
                page.drawText(`${paramData.name} Distribution:`, {
                    x: 50,
                    y: yPos,
                    size: 14,
                    font: fontBold,
                    color: rgb(0, 0, 0)
                });
                
                yPos -= 20;
                
                Object.keys(paramData.data).forEach(key => {
                    const count = paramData.data[key];
                    const percentage = ((count / total) * 100).toFixed(1);
                    
                    page.drawText(`- ${key}: ${count} (${percentage}%)`, {
                        x: 70,
                        y: yPos,
                        size: 12,
                        font: font,
                        color: rgb(0, 0, 0)
                    });
                    
                    yPos -= 20;
                });
                
                yPos -= 10;
            });
            
            // Save the PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            saveAs(blob, 'Ad_Targeting_Analytics_Report.pdf');
            
            loadingSection.classList.add('hidden');
        } catch (error) {
            console.error('Error generating PDF:', error);
            loadingSection.classList.add('hidden');
            alert('Error generating PDF report. Please try again.');
        }
    }
});