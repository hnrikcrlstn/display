$(document).ready(function() {
    $.support.cors = true;
    console.log('Script started');
})

$('#testBtn').on('click' , function() {
    
    console.log('Button clicked');
    
    var trainApiUrl = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
    var trainApiKey = '50aff4a70a3749b1b0921745f8d2086d';
    let xmlRequest = "<REQUEST>" +
                        "<LOGIN authenticationkey='"+ trainApiKey + "'/>" +
                        "<QUERY objecttype='TrainAnnouncement' schemaversion='1.8' orderby='AdvertisedTimeAtLocation' limit='15'>" +
                            "<FILTER>" +
                                "<AND>" +
                                    "<EQ name='ActivityType' value='Avgang' />" +
                                    "<EQ name='InformationOwner' value='SL' />" +
                                    "<EQ name='LocationSignature' value='Upv' />" +
                                    "<EQ name='Advertised' value='true' />" +
                                        "<AND>" +
                                                "<GT name='AdvertisedTimeAtLocation' value='$dateadd(-00:30:00)' />" +
                                                "<LT name='AdvertisedTimeAtLocation' value='$dateadd(02:00:00)' />" +
                                        "</AND>" +
                                "</AND>" +
                            "</FILTER>" +
                            "<INCLUDE>ProductInformation</INCLUDE>" +
                            "<INCLUDE>ScheduledDepartureDateTime</INCLUDE>" +
                            "<INCLUDE>EstimatedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>TimeAtLocation</INCLUDE>" +
                            "<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>ToLocation</INCLUDE>" +
                            "<INCLUDE>LocationSignature</INCLUDE>" +
                            "<INCLUDE>TrackAtLocation</INCLUDE>" +
                            "<INCLUDE>PlannedEstimatedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>OtherInformation</INCLUDE>" +
                            "<INCLUDE>Canceled</INCLUDE>" +
                            "<INCLUDE>Deviation</INCLUDE>" +
                        "</QUERY>" +
                    "</REQUEST>";

    $.ajax({
        type: "POST",
        url: trainApiUrl,
        contentType: "text/xml",
        dataType: "json",
        data: xmlRequest,
        success: function (response) {
            if (response == null) return;
            displayTrainInfo($(response.RESPONSE.RESULT[0].TrainAnnouncement));
        }
    });

    console.log('POST Done'); /* *** */

}).trigger('click');

function displayTrainInfo(data) {
    /*  Gather the next 15 departures
     *  Display the upcoming 4 departures
     *  Check for upcoming cancellations */
    console.log('displayTrainInfo started'); /* *** */

    let timeNow = Date.now(); /* Still used? */

    /* Reset old data */
    $('.trainDep').removeClass('delay');
    $('.trainDepNew').hide();
    $('.train-error').addClass('train-error-no-error');
    $('.train-error-output').html('');

    /* OtherInformations to ignore by error handler */
    const unimportantMessages = [
        'Resa förbi Arlanda C kräver både UL- och SL- biljett.', 
        'Anslutning till linje 48 mot Gnesta i Södertälje hamn.',
        'Anslutning till linje 48 mot Järna i Södertälje hamn.',
        'Stannar ej vid Trångsund, Skogås, Vega, Jordbro.',
        'Stannar ej vid Arlanda C.',
        'Kort tåg',
        'Spårändrat',
        'Stannar även vid Rosersberg.', 
        'Resa förbi Märsta kräver både UL- och SL- biljett.', 
        'Tåget går endast till Södertälje hamn.',
        'Anslutning till linje 48 mot Gnesta i Södertälje hamn.'];

    /* Array with station id for northen stations, to deduce travel orientation */
    const northenStations = ['U', 'Mr', 'Arnc', 'Kn', 'Rs'];
    
    console.log(data); /* *** */
    
    /* If there is a cancelled departure, store the index in a new array for future handling */
    let errorArray = [];
    
    /* Save number of north and south heading departures */
    let north = 0;
    let south = 0;

    /* Main loop of function, handle the stored train data one at a time */
    for (let i = 0; i < data.length; i++) {
        /* Checks for cancellations and delays, save train index for future handling */
        if (data[i].Deviation != null) {
            if (data[i].Deviation.length == 1 && !unimportantMessages.includes(data[i].Deviation[0].Description)) {
                console.log('Error level 1, ' + data[i].Deviation[0]); /* *** */
                errorArray.push(i);
            } else if (data[i].Deviation.length > 1) {
                for (let n = 0; n < data[i].Deviation.length; n++) {
                    if (!unimportantMessages.includes(data[i].Deviation[n].Description)) {
                        console.log('Error level 2, ' + data[i].Deviation[n].Description); /* *** */
                        errorArray.push(i);
                        n = data[i].Deviation.length + 1;
                    }
                }
            }
        }

        let direction = northenStations.includes(data[i].ToLocation[0].LocationName);

        if ((data[i].ToLocation[0].LocationName == 'U' && north < 2) || (!direction && south < 4)) {
            let trainTime = new Date(data[i].AdvertisedTimeAtLocation);
            let trainTimeEst;

            /* Check for new est. time */
            if (data[i].EstimatedTimeAtLocation) {
                trainTimeEst = new Date(data[i].EstimatedTimeAtLocation);
            }
            
            /* Calculate container classes */
            let trainContain;
            if (direction > 0) {
                trainContain = '.train-n-' + north;
            } else {
                trainContain = '.train-s-' + south;
            }

            /* Determine if data post is relevant to display */
            let relevant = false;
            if (trainTime - Date.now() > 0) {
                relevant = true;
            }
            if (data[i].EstimatedTimeAtLocation && trainTimeEst - Date.now() > 0) {
                relevant = true;
            }

            if (relevant) {
                if (data[i].Canceled) {
                    $(trainContain).addClass('canceled');
                }

                let trainTimePrint;
                if (trainTimeEst > 0) {
                    trainTimePrint = (Math.ceil((trainTimeEst - Date.now()) / 1000 / 60) - 1) == 0 ? 'Nu' : Math.ceil((trainTimeEst - Date.now()) / 1000 / 60) - 1 + ' <span class="train-time-unit">min</span>';
                } else {
                    trainTimePrint = (Math.ceil((trainTime - Date.now()) / 1000 / 60) - 1) == 0 ? 'Nu' : Math.ceil((trainTime - Date.now()) / 1000 / 60) - 1 + ' <span class="train-time-unit">min</span>';
                }

                $(trainContain + ' .trainDep').text(addZero(trainTime.getHours()) + ':' + addZero(trainTime.getMinutes()));
                $(trainContain + ' .trainTime').html((trainTimePrint));

                /* If time as been changed, notify */
                if (trainTimeEst &&  (Math.round(trainTimeEst - trainTime) / 500 / 60) > 1) {
                    $(trainContain + ' .trainDep').addClass('delay');
                    $(trainContain + ' .trainDepNew').text(addZero(trainTimeEst.getHours()) + ':' + addZero(trainTimeEst.getMinutes())).show();
                }

                /* Keep track of how many north- and southbound trains has been presented */
                if (direction) {
                    north++;
                } else {
                    south++;
                }
            }
        }
    }
    
    console.log('Script finished'); /* *** */

    if (errorArray.length > 0) {
        $('.train-label-error, .train-error-no-error').removeClass('train-error-no-error');
        for (let i = 0; i < errorArray.length; i++) {
            displayError(data[errorArray[i]].ProductInformation[1].Description, data[errorArray[i]].Deviation[0].Description, data[errorArray[i]].AdvertisedTimeAtLocation, northenStations.includes(data[errorArray[i]].ToLocation[0].LocationName));
        }
    }
}

function displayError(trainData, message, time, north) {
    let tempTime = new Date(time);
    let formatedTime = addZero(tempTime.getHours()) + ':' + addZero(tempTime.getMinutes());
    $('.train-error-output').append('<li>' + formatedTime + ', linje ' + trainData + ' ' + (north ? 'norr' : 'söder') + ': ' + message + '</li>');
}

function addZero(i) {
    if (i < 10) {
        i = '0' + i;
    }
    return i;
}