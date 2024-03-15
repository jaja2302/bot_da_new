const {
    default: makeWASocket,
    MessageType,
    MessageOptions,
    Mimetype,
    DisconnectReason,
    BufferJSON,
    AnyMessageContent,
    delay,
    fetchLatestBaileysVersion,
    isJidBroadcast,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    MessageRetryMap,
    useMultiFileAuthState,
    msgRetryCounterMap
} = require("@whiskeysockets/baileys");


const log = (pino = require("pino"));
const { session } = { "session": "baileys_auth_info" };
const { Boom } = require("@hapi/boom");
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require("express");
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require("body-parser");
const app = require("express")()
const cron = require('node-cron');
const axios = require('axios');

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const port = process.env.PORT || 8000;
const qrcode = require("qrcode");
const { Console } = require("console");

app.use("/assets", express.static(__dirname + "/client/assets"));

app.get("/scan", (req, res) => {
    res.sendFile("./client/server.html", {
        root: __dirname,
    });
});

app.get("/", (req, res) => {
    res.sendFile("./client/index.html", {
        root: __dirname,
    });
});
//fungsi suara capital 
function capital(textSound) {
    const arr = textSound.split(" ");
    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
    }
    const str = arr.join(" ");
    return str;
}
const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

let sock;
let qr;
let soket;
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 because getMonth() returns zero-based index
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get the current date
const today = new Date();

// Format the current date to 'YYYY-MM-DD' format
const datetimeValue = formatDate(today);
const idgroup = '120363205553012899@g.us' 
// const idgroup = '120363204285862734@g.us'


async function senddata(groupID, destinationPath,fileName) {
    const pesankirim = fileName

    const messageOptions = {
        document: {
            url: destinationPath,
            caption: pesankirim
        },
        fileName: fileName
    };

    // Send the PDF file
    await sock.sendMessage(groupID, messageOptions);

    // Unlink the file after sending
    fs.unlink(destinationPath, (err) => {
        if (err) {
            console.error('Error unlinking the file:', err);
            
        }
    });

}

async function checkAndDeleteFiles() {
    try {
        const getStatus = await axios.get('https://srs-ssms.com/whatsapp_bot/checkfolderstatus.php');
        const { data: folderStatus } = getStatus;

        if (Array.isArray(folderStatus) && folderStatus.length > 0) {
            const filesToDelete = folderStatus.filter((file) => file.hasOwnProperty('wilayah') && file.hasOwnProperty('filename'));

            for (const file of filesToDelete) {
                const { wilayah, filename } = file;
                await deleteFile(filename, wilayah);
            }
        } else {
            console.log('No files found or empty folder. Nothing to delete.');
           
        }
    } catch (error) {
        console.log('Error checking and deleting files:', error.status);
        await sock.sendMessage(idgroup, { text: 'Error checking and deleting files' })
    }
}


async function deleteFile(filename, folder) {
    try {
        const response = await axios.head(`https://srs-ssms.com/whatsapp_bot/deletebot.php?filename=${filename}&path=${folder}`);

        if (response.status === 200) {
            await axios.get(`https://srs-ssms.com/whatsapp_bot/deletebot.php?filename=${filename}&path=${folder}`);
            console.log(`File '${filename}' in folder '${folder}' deleted successfully.`);
        } else if (response.status === 404) {
            console.log(`File '${filename}' in folder '${folder}' doesn't exist. Skipping deletion.`);
        } else {
            console.log(`Unexpected status code ${response.status} received. Skipping deletion.`);
        }
    } catch (error) {
        console.log(`Error checking or deleting file '${filename}' in folder '${folder}':`, error.message);
        await sock.sendMessage(idgroup, { text: 'Error checking or deleting file' })
    }
}

async function sendPdfToGroups(folder, groupID) {
    try {
        const response = await axios.get(`https://srs-ssms.com/whatsapp_bot/taksasiScan.php?folder=${folder}`);

        // Accessing the response data
        const files = response.data;

        if (!files || files.length === 0) {
            return res.status(200).json({
                status: false,
                response: "Folder is empty"
            });
        }

        for (const key in files) {
            if (Object.hasOwnProperty.call(files, key)) {
                const fileName = files[key];
                const fileUrl = `https://srs-ssms.com/whatsapp_bot/taksasi/${folder}/${fileName}`;
                const destinationPath = `./uploads/${fileName}`;

                const file = fs.createWriteStream(destinationPath);

                await new Promise((resolve, reject) => {
                    https.get(fileUrl, function(response) {
                        response.pipe(file);
                        file.on('finish', function() {
                            file.close(() => {
                                console.log('File downloaded successfully.');
                                resolve(); // Resolve the promise after the file is downloaded
                            });
                        });
                    }).on('error', function(err) {
                        fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
                        console.error('Error downloading the file:', err);
                        reject(err); // Reject the promise if there is an error
                    });
                });

                await senddata(groupID, destinationPath, fileName);
                await deleteFile(fileName, folder);
            }
        }
        await sock.sendMessage(idgroup, { text: 'Laporan berhasil di kirim ke grup' })
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

  
async function Generatedmapsest(estate, datetime) {
    const maxRetries = 5;
    let retryCount = 0;
    while (retryCount < maxRetries) {
        try {
            const formData = new URLSearchParams();
            formData.append('estate', estate);
            formData.append('datetime', datetime);

            const response = await axios.post('https://digi-kappa-lac.vercel.app/api/run', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded' // Set the proper content type for form data
                }
            });

            console.log('Response data:', response.data); // Access the response data
            await sock.sendMessage(idgroup, { text: `Map ${estate} berhasil di generate` });
            return response.data;
        } catch (error) {
            console.error('Error fetching data:', error);
            await sock.sendMessage(idgroup, { text: `Map ${estate} gagal di generate ${error.status}`});
            retryCount++;
            if (retryCount === maxRetries) {
                await sock.sendMessage(idgroup, { text: `Terjadi kesalahan menarik ${estate} yang gagal di generate`});
                throw error;
            } else {
                console.log(`Retrying (${retryCount}/${maxRetries})...`);
                await sock.sendMessage(idgroup, { text: `Menarik ulang Map ${estate} yang gagal di generate`});
            }
        }
    }
}


  
async function GenDefaultTaksasi(est) {
    // const url = `https://srs-ssms.com/rekap_pdf/pdf_taksasi_folder.php?est=${est.toLowerCase()}`;
    // await generatetpdf(url);
    try {
        const response = await axios.get(`https://srs-ssms.com/rekap_pdf/pdf_taksasi_folder.php?est=${est.toLowerCase()}`);
        await sock.sendMessage(idgroup, { text: `Pdf berhasil di generate ${est}` })
        return response;
      } catch (error) {
        console.error('Error fetching data:', error.status);
        await sock.sendMessage(idgroup, { text: 'Pdf gagal di generate' + error.status })
      }
}
  
  
async function sendtaksasiest(est) {
    try {
        let folder;
        // Mapping the est value to the corresponding folder
        switch (est) {
            case 'PLE':
            case 'KNE':
            case 'RDE':
            case 'SLE':
                folder = 'Wilayah_1';
                break;
            case 'KDE':
            case 'BKE':
            case 'RGE':
            case 'SGE':
                folder = 'Wilayah_2';
                break;
            case 'SYE':
            case 'BGE':
            case 'NBE':
            case 'UPE':
                folder = 'Wilayah_3';
                break;
            case 'MRE':
            case 'NKE':
            case 'PDE':
            case 'SPE':
                folder = 'Wilayah_4';
                break;
            case 'BTE':
            case 'NNE':
            case 'SBE':
                folder = 'Wilayah_5';
                break;
            case 'MLE':
            case 'SCE':
                folder = 'Wilayah_6';
                break;
            case 'PKE':
            case 'BDE':
            case 'KTE':
            case 'MKE':
           
                folder = 'Wilayah_7';
                break;

            case 'BHE':

                folder = 'Wilayah_8';
                break;
        
            case 'TBE':
            case 'KTE4':
            case 'SJE':
            folder = 'Inti';
            break;
            case 'LME1':
            case 'LME2':
            folder = 'Plasma';
                break;
            case 'test':
            folder = 'Wilayah_testing';
                break;
            default:
                // Handle cases where est doesn't match any defined folders
                console.log('Invalid est value provided.');
                await sock.sendMessage(idgroup, { text: 'Kadidak ulun cari estate ni!'})

                return;
        }
      
        // await Generatedmapsest(est);
        await checkAndDeleteFiles(); 
        await Generatedmapsest(est,datetimeValue)
        await GenDefaultTaksasi(est)
        // await sendmsgAws(`Generate pdf untuk ${est} sukses`, '120363205553012899@g.us');

        // await client.sendMessage(`Generate pdf untuk ${est} sukses`);
        // console.log(`Files generated successfully for '${est}' in folder '${folder}'.`);

        // testing 
        if (folder === 'Wilayah_1') {
            await sendPdfToGroups(folder, '120363025737216061@g.us');
             // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
        } else if (folder === 'Wilayah_2') {
            await sendPdfToGroups(folder, '120363047670143778@g.us');
             // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
        } else if (folder === 'Wilayah_3') {
            await sendPdfToGroups(folder, '120363048442215265@g.us');
             // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
        }  else if (folder === 'Wilayah_4') {
            if (est === 'SPE') {
                await sendPdfToGroups(folder, '120363220419839708@g.us');
                // testing 
                // await sendPdfToGroups(folder, '120363204285862734@g.us');
            }else if (est === 'NKE'){
                await sendPdfToGroups(folder, '120363217152686034@g.us');
                  // testing 
                 //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            }  else if (est === 'PDE'){
                await sendPdfToGroups(folder, '120363217291038671@g.us');
                  // testing 
                // await sendPdfToGroups(folder, '120363204285862734@g.us');
            }else if (est === 'MRE'){
                await sendPdfToGroups(folder, '120363217205685424@g.us');
                // testing 
                //   await sendPdfToGroups(folder, '120363204285862734@g.us');
            }
        }else if (folder === 'Wilayah_5') {
            if (est === 'SBE') {
                await sendPdfToGroups(folder, '120363220146576654@g.us');
                  // testing 
                //  await sendPdfToGroups(folder, '120363204285862734@g.us');  
            } else if (est === 'BTE') {
                await sendPdfToGroups(folder, '120363226513991710@g.us');
                  // testing 
                //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            }  else if (est === 'NNE') {
                await sendPdfToGroups(folder, '120363231670115838@g.us');
                  // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            } 
        } else if (folder === 'Wilayah_6') {
            if (est === 'SCE') {
                await sendPdfToGroups(folder, '120363232871713646@g.us');
                  // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            } else if (est === 'MLE'){
                await sendPdfToGroups(folder, '120363213054175770@g.us');
                  // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            }
        } else if (folder === 'Wilayah_7') {
            if (est === 'KTE') {
                await sendPdfToGroups(folder, '120363170524329595@g.us');
                  // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            } else if (est === 'BDE') {
                await sendPdfToGroups(folder, '120363166668733371@g.us');
                  // testing 
                //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            }

            // testing 
            // grup asli = 120363166668733371@g.us
            // grup testing = 120363205553012899@g.us

        } else if (folder === 'Wilayah_8') {
            if (est === 'BHE') {
                await sendPdfToGroups(folder, '120363149785590346@g.us');
                  // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            }
        }else if (folder === 'Inti') {
            if (est === 'SJE') {
                await sendPdfToGroups(folder, '120363207525577365@g.us');
                  // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            } else if (est === 'KTE4'){
                await sendPdfToGroups(folder, '120363210871038595@g.us');
                  // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            }
            else {
                await sendPdfToGroups(folder, '120363193125275627@g.us');
                  // testing 
                 // await sendPdfToGroups(folder, '120363204285862734@g.us');
            }
           
        }else if (folder === 'Plasma') {
            if (est === 'LME1') {
                await sendPdfToGroups(folder, '120363208984887370@g.us');
                  // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            } else if (est === 'LME2'){
                await sendPdfToGroups(folder, '120363193243380343@g.us');
                  // testing 
            //  await sendPdfToGroups(folder, '120363204285862734@g.us');
            }
        }else if (folder === 'Wilayah_testing') {
            await sendPdfToGroups(folder, '120363204285862734@g.us');
        }
        // await sendMessage(`kirim pdf untuk ${est} sukses`);
 
        // await sendmsgAws(`kirim pdf untuk ${est} sukses`, '120363205553012899@g.us');

    } catch (error) {
        console.log(`Error fetching files:`, error);
        // logError(error);
    }
}


async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
    let { version, isLatest } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: log({ level: "silent" }),
        version,
        shouldIgnoreJid: jid => isJidBroadcast(jid),
    });
    store.bind(sock.ev);
    sock.multi = true
    sock.ev.on('connection.update', async (update) => {
        //console.log(update);
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect.error).output.statusCode;
            if (reason === DisconnectReason.badSession) {
                console.log(`Bad Session File, Please Delete ${session} and Scan Again`);
                sock.logout();
            } else if (reason === DisconnectReason.connectionClosed) {
                console.log("Connection closed, reconnecting....");
                connectToWhatsApp();
            } else if (reason === DisconnectReason.connectionLost) {
                console.log("Connection Lost from Server, reconnecting...");
                connectToWhatsApp();
            } else if (reason === DisconnectReason.connectionReplaced) {
                console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                sock.logout();
            } else if (reason === DisconnectReason.loggedOut) {
                console.log(`Device Logged Out, Please Delete ${session} and Scan Again.`);
                sock.logout();
            } else if (reason === DisconnectReason.restartRequired) {
                console.log("Restart Required, Restarting...");
                connectToWhatsApp();
            } else if (reason === DisconnectReason.timedOut) {
                console.log("Connection TimedOut, Reconnecting...");
                connectToWhatsApp();
            } else {
                sock.end(`Unknown DisconnectReason: ${reason}|${lastDisconnect.error}`);
            }
        } else if (connection === 'open') {
            // console.log('opened connection');
            let getGroups = await sock.groupFetchAllParticipating();
            let groups = Object.values(await sock.groupFetchAllParticipating())
            //console.log(groups);
            for (let group of groups) {
                console.log("id_group: " + group.id + " || Nama Group: " + group.subject);
            }
            return;
        }
        if (update.qr) {
            qr = update.qr;
            updateQR("qr");
        }
        else if (qr = undefined) {
            updateQR("loading");
        }
        else {
            if (update.connection === "open") {
                updateQR("qrscanned");
                return;
            }
        }
    });
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", async function handleUpsert({ messages, type }) {
        for (const message of messages) {
            if (!message.key.fromMe) {
                const text = message.message.conversation;
                const noWa = message.key.remoteJid;
                const lowerCaseMessage = text.toLowerCase();
                
                if (lowerCaseMessage === "!tes") {
                    await sock.sendMessage(noWa, { text: "Masukan Estate Harus Huruf Besar ?" }, { quoted: message });
    
                    // Define a function to handle the response
                    async function handleResponse({ messages: responseMessages }) {
                        for (const responseMessage of responseMessages) {
                            if (!responseMessage.key.fromMe && responseMessage.key.remoteJid === noWa) {
                                const estate = responseMessage.message.conversation;
                                await sendtaksasiest(estate);
                           
                                // Remove the event listener after processing the response
                                sock.ev.off("messages.upsert", handleResponse);
                                clearTimeout(timer); // Clear the timeout when response is received
                                break; // Exit the loop after processing the response
                            }
                        }
                    }
    
                    // Attach the response handler to the event
                    sock.ev.on("messages.upsert", handleResponse);
    
                    // Set timeout
                    const timer = setTimeout(() => {
                        // Handle timeout
                        sock.ev.off("messages.upsert", handleResponse); // Remove the event listener
                        sock.sendMessage(noWa, { text: 'Waktu Habis silahkan tarik kembali'}, { quoted: message }); // Notify user about timeout
                        // You can add code here to handle the timeout scenario
                    }, 10000); // 1 minute timeout (60000 milliseconds)
    
                    break; // Exit the loop after sending the prompt
                }
                else if (lowerCaseMessage === "!menu") {
                    await sock.sendMessage(noWa, { text: "Perintah Bot Yang tersida \n1 = !tarik (Menarik Estate yang di pilih untuk di generate ke dalam grup yang sudah di tentukan) \n2 = !getgrup (mendapatkan List Group yang tersedia dan ID Group) \n3 = !restartwa (Akan Merestart Server Wa untuk merefresh semua grup baru di tambahkan)" }, { quoted: message });
                    break;
                }else if (lowerCaseMessage === "!getgrup") {
                    // console.log('ini group');
                    let getGroups = await sock.groupFetchAllParticipating();
                    let groups = Object.values(await sock.groupFetchAllParticipating());
                    let datagrup = []; // Initialize an empty array to store group information
                    
                    for (let group of groups) {
                        datagrup.push(`id_group: ${group.id} || Nama Group: ${group.subject}`);
                    }
                    
                    await sock.sendMessage(noWa, { text: `List ${datagrup.join('\n')}` }, { quoted: message }); 

                    break;
                }
            }
        }
    });
    
    
}


io.on("connection", async (socket) => {
    soket = socket;
    // console.log(sock)
    if (isConnected) {
        updateQR("connected");
    } else if (qr) {
        updateQR("qr");
    }
});

// functions
const isConnected = () => {
    return (sock.user);
};

const updateQR = (data) => {
    switch (data) {
        case "qr":
            qrcode.toDataURL(qr, (err, url) => {
                soket?.emit("qr", url);
                soket?.emit("log", "QR Code received, please scan!");
            });
            break;
        case "connected":
            soket?.emit("qrstatus", "./assets/check.svg");
            soket?.emit("log", "WhatsApp terhubung!");
            break;
        case "qrscanned":
            soket?.emit("qrstatus", "./assets/check.svg");
            soket?.emit("log", "QR Code Telah discan!");
            break;
        case "loading":
            soket?.emit("qrstatus", "./assets/loader.gif");
            soket?.emit("log", "Registering QR Code , please wait!");
            break;
        default:
            break;
    }
};


// send text message to wa user
app.post("/send-message", async (req, res) => {
    //console.log(req);
    const pesankirim = req.body.message;
    const number = req.body.number;
    const fileDikirim = req.files;

    let numberWA;
    try {
        if (!req.files) {
            if (!number) {
                res.status(500).json({
                    status: false,
                    response: 'Nomor WA belum tidak disertakan!'
                });
            }
            else {
                numberWA = '62' + number.substring(1) + "@s.whatsapp.net";
                console.log(await sock.onWhatsApp(numberWA));
                if (isConnected) {
                    const exists = await sock.onWhatsApp(numberWA);
                    if (exists?.jid || (exists && exists[0]?.jid)) {
                        sock.sendMessage(exists.jid || exists[0].jid, { text: pesankirim })
                            .then((result) => {
                                res.status(200).json({
                                    status: true,
                                    response: result,
                                });
                            })
                            .catch((err) => {
                                res.status(500).json({
                                    status: false,
                                    response: err,
                                });
                            });
                    } else {
                        res.status(500).json({
                            status: false,
                            response: `Nomor ${number} tidak terdaftar.`,
                        });
                    }
                } else {
                    res.status(500).json({
                        status: false,
                        response: `WhatsApp belum terhubung.`,
                    });
                }
            }
        }
        else {
            //console.log('Kirim document');
            if (!number) {
                res.status(500).json({
                    status: false,
                    response: 'Nomor WA belum tidak disertakan!'
                });
            }
            else {

                numberWA = '62' + number.substring(1) + "@s.whatsapp.net";
                //console.log('Kirim document ke'+ numberWA);
                let filesimpan = req.files.file_dikirim;
                var file_ubah_nama = new Date().getTime() + '_' + filesimpan.name;
                //pindahkan file ke dalam upload directory
                filesimpan.mv('./uploads/' + file_ubah_nama);
                let fileDikirim_Mime = filesimpan.mimetype;
                //console.log('Simpan document '+fileDikirim_Mime);

                //console.log(await sock.onWhatsApp(numberWA));

                if (isConnected) {
                    const exists = await sock.onWhatsApp(numberWA);

                    if (exists?.jid || (exists && exists[0]?.jid)) {

                        let namafiledikirim = './uploads/' + file_ubah_nama;
                        let extensionName = path.extname(namafiledikirim);
                        //console.log(extensionName);
                        if (extensionName === '.jpeg' || extensionName === '.jpg' || extensionName === '.png' || extensionName === '.gif') {
                            await sock.sendMessage(exists.jid || exists[0].jid, {
                                image: {
                                    url: namafiledikirim
                                },
                                caption: pesankirim
                            }).then((result) => {
                                if (fs.existsSync(namafiledikirim)) {
                                    fs.unlink(namafiledikirim, (err) => {
                                        if (err && err.code == "ENOENT") {
                                            // file doens't exist
                                            console.info("File doesn't exist, won't remove it.");
                                        } else if (err) {
                                            console.error("Error occurred while trying to remove file.");
                                        }
                                        //console.log('File deleted!');
                                    });
                                }
                                res.send({
                                    status: true,
                                    message: 'Success',
                                    data: {
                                        name: filesimpan.name,
                                        mimetype: filesimpan.mimetype,
                                        size: filesimpan.size
                                    }
                                });
                            }).catch((err) => {
                                res.status(500).json({
                                    status: false,
                                    response: err,
                                });
                                console.log('pesan gagal terkirim');
                            });
                        } else if (extensionName === '.mp3' || extensionName === '.ogg') {
                            await sock.sendMessage(exists.jid || exists[0].jid, {
                                audio: {
                                    url: namafiledikirim,
                                    caption: pesankirim
                                },
                                mimetype: 'audio/mp4'
                            }).then((result) => {
                                if (fs.existsSync(namafiledikirim)) {
                                    fs.unlink(namafiledikirim, (err) => {
                                        if (err && err.code == "ENOENT") {
                                            // file doens't exist
                                            console.info("File doesn't exist, won't remove it.");
                                        } else if (err) {
                                            console.error("Error occurred while trying to remove file.");
                                        }
                                        //console.log('File deleted!');
                                    });
                                }
                                res.send({
                                    status: true,
                                    message: 'Success',
                                    data: {
                                        name: filesimpan.name,
                                        mimetype: filesimpan.mimetype,
                                        size: filesimpan.size
                                    }
                                });
                            }).catch((err) => {
                                res.status(500).json({
                                    status: false,
                                    response: err,
                                });
                                console.log('pesan gagal terkirim');
                            });
                        } else {
                            await sock.sendMessage(exists.jid || exists[0].jid, {
                                document: {
                                    url: namafiledikirim,
                                    caption: pesankirim
                                },
                                mimetype: fileDikirim_Mime,
                                fileName: filesimpan.name
                            }).then((result) => {
                                if (fs.existsSync(namafiledikirim)) {
                                    fs.unlink(namafiledikirim, (err) => {
                                        if (err && err.code == "ENOENT") {
                                            // file doens't exist
                                            console.info("File doesn't exist, won't remove it.");
                                        } else if (err) {
                                            console.error("Error occurred while trying to remove file.");
                                        }
                                        //console.log('File deleted!');
                                    });
                                }
                                /*
                                setTimeout(() => {
                                    sock.sendMessage(exists.jid || exists[0].jid, {text: pesankirim});
                                }, 1000);
                                */
                                res.send({
                                    status: true,
                                    message: 'Success',
                                    data: {
                                        name: filesimpan.name,
                                        mimetype: filesimpan.mimetype,
                                        size: filesimpan.size
                                    }
                                });
                            }).catch((err) => {
                                res.status(500).json({
                                    status: false,
                                    response: err,
                                });
                                console.log('pesan gagal terkirim');
                            });
                        }
                    } else {
                        res.status(500).json({
                            status: false,
                            response: `Nomor ${number} tidak terdaftar.`,
                        });
                    }
                } else {
                    res.status(500).json({
                        status: false,
                        response: `WhatsApp belum terhubung.`,
                    });
                }
            }
        }
    } catch (err) {
        res.status(500).send(err);
    }

});

// send group message
app.post("/send-group-message", async (req, res) => {
    //console.log(req);
    const pesankirim = req.body.message;
    const id_group = req.body.id_group;
    const fileDikirim = req.files;
    let idgroup;
    let exist_idgroup;
    try {
        if (isConnected) {
            if (!req.files) {
                if (!id_group) {
                    res.status(500).json({
                        status: false,
                        response: 'Nomor Id Group belum disertakan!'
                    });
                }
                else {
                    let exist_idgroup = await sock.groupMetadata(id_group);
                    console.log(exist_idgroup.id);
                    console.log("isConnected");
                    if (exist_idgroup?.id || (exist_idgroup && exist_idgroup[0]?.id)) {
                        sock.sendMessage(id_group, { text: pesankirim })
                            .then((result) => {
                                res.status(200).json({
                                    status: true,
                                    response: result,
                                });
                                console.log("succes terkirim");
                            })
                            .catch((err) => {
                                res.status(500).json({
                                    status: false,
                                    response: err,
                                });
                                console.log("error 500");
                            });
                    } else {
                        res.status(500).json({
                            status: false,
                            response: `ID Group ${id_group} tidak terdaftar.`,
                        });
                        console.log(`ID Group ${id_group} tidak terdaftar.`);
                    }
                }

            } else {
                //console.log('Kirim document');
                if (!id_group) {
                    res.status(500).json({
                        status: false,
                        response: 'Id Group tidak disertakan!'
                    });
                }
                else {
                    exist_idgroup = await sock.groupMetadata(id_group);
                    console.log(exist_idgroup.id);
                    //console.log('Kirim document ke group'+ exist_idgroup.subject);

                    let filesimpan = req.files.file_dikirim;
                    var file_ubah_nama = new Date().getTime() + '_' + filesimpan.name;
                    //pindahkan file ke dalam upload directory
                    filesimpan.mv('./uploads/' + file_ubah_nama);
                    let fileDikirim_Mime = filesimpan.mimetype;
                    //console.log('Simpan document '+fileDikirim_Mime);
                    if (isConnected) {
                        if (exist_idgroup?.id || (exist_idgroup && exist_idgroup[0]?.id)) {
                            let namafiledikirim = './uploads/' + file_ubah_nama;
                            let extensionName = path.extname(namafiledikirim);
                            //console.log(extensionName);
                            if (extensionName === '.jpeg' || extensionName === '.jpg' || extensionName === '.png' || extensionName === '.gif') {
                                await sock.sendMessage(exist_idgroup.id || exist_idgroup[0].id, {
                                    image: {
                                        url: namafiledikirim
                                    },
                                    caption: pesankirim
                                }).then((result) => {
                                    if (fs.existsSync(namafiledikirim)) {
                                        fs.unlink(namafiledikirim, (err) => {
                                            if (err && err.code == "ENOENT") {
                                                // file doens't exist
                                                console.info("File doesn't exist, won't remove it.");
                                            } else if (err) {
                                                console.error("Error occurred while trying to remove file.");
                                            }
                                            //console.log('File deleted!');
                                        });
                                    }
                                    res.send({
                                        status: true,
                                        message: 'Success',
                                        data: {
                                            name: filesimpan.name,
                                            mimetype: filesimpan.mimetype,
                                            size: filesimpan.size
                                        }
                                    });
                                }).catch((err) => {
                                    res.status(500).json({
                                        status: false,
                                        response: err,
                                    });
                                    console.log('pesan gagal terkirim');
                                });
                            } else if (extensionName === '.mp3' || extensionName === '.ogg') {
                                await sock.sendMessage(exist_idgroup.id || exist_idgroup[0].id, {
                                    audio: {
                                        url: namafiledikirim,
                                        caption: pesankirim
                                    },
                                    mimetype: 'audio/mp4'
                                }).then((result) => {
                                    if (fs.existsSync(namafiledikirim)) {
                                        fs.unlink(namafiledikirim, (err) => {
                                            if (err && err.code == "ENOENT") {
                                                // file doens't exist
                                                console.info("File doesn't exist, won't remove it.");
                                            } else if (err) {
                                                console.error("Error occurred while trying to remove file.");
                                            }
                                            //console.log('File deleted!');
                                        });
                                    }
                                    res.send({
                                        status: true,
                                        message: 'Success',
                                        data: {
                                            name: filesimpan.name,
                                            mimetype: filesimpan.mimetype,
                                            size: filesimpan.size
                                        }
                                    });
                                }).catch((err) => {
                                    res.status(500).json({
                                        status: false,
                                        response: err,
                                    });
                                    console.log('pesan gagal terkirim');
                                });
                            } else {
                                await sock.sendMessage(exist_idgroup.id || exist_idgroup[0].id, {
                                    document: {
                                        url: namafiledikirim,
                                        caption: pesankirim
                                    },
                                    mimetype: fileDikirim_Mime,
                                    fileName: filesimpan.name
                                }).then((result) => {
                                    if (fs.existsSync(namafiledikirim)) {
                                        fs.unlink(namafiledikirim, (err) => {
                                            if (err && err.code == "ENOENT") {
                                                // file doens't exist
                                                console.info("File doesn't exist, won't remove it.");
                                            } else if (err) {
                                                console.error("Error occurred while trying to remove file.");
                                            }
                                            //console.log('File deleted!');
                                        });
                                    }

                                    setTimeout(() => {
                                        sock.sendMessage(exist_idgroup.id || exist_idgroup[0].id, { text: pesankirim });
                                    }, 1000);

                                    res.send({
                                        status: true,
                                        message: 'Success',
                                        data: {
                                            name: filesimpan.name,
                                            mimetype: filesimpan.mimetype,
                                            size: filesimpan.size
                                        }
                                    });
                                }).catch((err) => {
                                    res.status(500).json({
                                        status: false,
                                        response: err,
                                    });
                                    console.log('pesan gagal terkirim');
                                });
                            }
                        } else {
                            res.status(500).json({
                                status: false,
                                response: `Nomor ${number} tidak terdaftar.`,
                            });
                        }
                    } else {
                        res.status(500).json({
                            status: false,
                            response: `WhatsApp belum terhubung.`,
                        });
                    }
                }
            }

            //end is connected
        } else {
            res.status(500).json({
                status: false,
                response: `WhatsApp belum terhubung.`,
            });
        }

        //end try
    } catch (err) {
        res.status(500).send(err);
    }

});



app.post("/sendpdfs", async (req, res) => {
    try {
        const folder = 'Wilayah_testing'; // Assuming you're passing the folder name in the request body
        const idgroup = '120363205553012899@g.us';
       
    } catch (error) {
        console.error("Error sending files:", error);
        res.status(500).json({
            status: false,
            response: error.message || "Internal Server Error"
        });
    }
});

// const tasks = [
//     { 
//         time: '00 09 * * *', 
//         message: 'Kirim Taksasi Wil 7 BDE  Jam 09:00', 
//         regions: ['Wilayah_7'], 
//         groupId: '120363166668733371@g.us',

//         // tes 
//         // groupId: '120363205553012899@g.us',
//         generate: 'BDE',
//         versi: '2'
//     },
//     { 
//         time: '00 11 * * *', 
//         message: 'Kirim Taksasi NKE Wil 4  Jam 11:05', 
//         regions: ['Wilayah_4'], 
//         groupId: '120363217152686034@g.us',
//         // groupId: '120363205553012899@g.us',

//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'NKE',
//         versi: '2'
//     },
//     { 
//         time: '00 12 * * *', 
//         message: 'Kirim Taksasi KTE Wil 7  Jam 12:00', 
//         regions: ['Wilayah_7'], 
//         groupId: '120363170524329595@g.us',

//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'KTE',
//         versi: '2'
//     },
//     { 
//         time: '02 12 * * *', 
//         message: 'Kirim Taksasi SPE Wil 4  Jam 12:03', 
//         regions: ['Wilayah_4'], 
//         groupId: '120363220419839708@g.us',

//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'SPE',
//         versi: '2'
//     },
//     { 
//         time: '04 12 * * *', 
//         message: 'Kirim Taksasi LME1  Jam 12:03', 
//         regions: ['Plasma'], 
//         groupId: '120363208984887370@g.us',
//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'LME1',
//         versi: '2'
//     },
//     { 
//         time: '06 12 * * *', 
//         message: 'Kirim Taksasi PDE  Jam 12:04', 
//         regions: ['Wilayah_4'], 
//         groupId: '120363217291038671@g.us',
//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'PDE',
//         versi: '1'
//     },
//     { 
//         time: '08 12 * * *', 
//         message: 'Kirim Taksasi SBE  Jam 12:04', 
//         regions: ['Wilayah_5'], 
//         groupId: '120363220146576654@g.us',
//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'SBE',
//         versi: '1'
//     },
//     { 
//         time: '10 12 * * *', 
//         message: 'Kirim Taksasi BTE  Jam 12:10', 
//         regions: ['Wilayah_5'], 
//         groupId: '120363226513991710@g.us',
      
//         generate: 'BTE',
//         versi: '1'
//     },

//     { 
//         time: '12 12 * * *', 
//         message: 'Kirim Taksasi MLE  Jam 12:12', 
//         regions: ['Wilayah_6'], 
//         groupId: '120363213054175770@g.us',
      
//         generate: 'MLE',
//         versi: '1'
//     },
//     { 
//         time: '14 12 * * *', 
//         message: 'Kirim Taksasi MRE  Jam 12:14', 
//         regions: ['Wilayah_4'], 
//         groupId: '120363217205685424@g.us',
      
//         generate: 'MRE',
//         versi: '1'
//     },
//     { 
//         time: '16 12 * * *', 
//         message: 'Kirim Taksasi LME2  Jam 12:16', 
//         regions: ['Plasma'], 
//         groupId: '120363193243380343@g.us',
      
//         generate: 'LME2',
//         versi: '1'
//     },
//     { 
//         time: '00 10 * * *', 
//         message: 'Kirim Taksasi NNE  Jam 00:10', 
//         regions: ['Wilayah_5'], 
//         groupId: '120363231670115838@g.us',
//         generate: 'NNE',
//         versi: '1'
//     },
//     { 
//         time: '00 15 * * *', 
//         message: 'Kirim Taksasi BHE Jam 15:00', 
//         regions: ['Wilayah_8'], 
//         groupId: '120363149785590346@g.us',
//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'BHE',
//         versi: '2'
//     },
//     { 
//         time: '03 15 * * *', 
//         message: 'Kirim Taksasi SJE Jam 15:00', 
//         regions: ['Inti'], 
//         groupId: '120363207525577365@g.us',
//         generate: 'SJE',
//         versi: '2'
//     },
//     { 
//         time: '05 15 * * *', 
//         message: 'Kirim Taksasi KTE4 Jam 15:05', 
//         regions: ['Inti'], 
//         groupId: '120363210871038595@g.us',
//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'KTE4',
//         versi: '2'
//     },
//     { 
//         time: '00 14 * * *', 
//         message: 'Kirim Taksasi SCE  Jam 14:00', 
//         regions: ['Wilayah_6'], 
//         groupId: '120363232871713646@g.us',
//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'SCE',
//         versi: '2'
//     },
//     { 
//         time: '03 14 * * *', 
//         message: 'Kirim Taksasi TBE  Jam 12:03', 
//         regions: ['Inti'], 
//         groupId: '120363193125275627@g.us',
//         // testgrup
//         // groupId: '120363205553012899@g.us',
//         generate: 'TBE',
//         versi: '2'
//     },
//     { 
//         time: '00 16 * * *', 
//         message: 'Kirim Taksasi RDE  Jam 4 sore', 
//         regions: ['Wilayah_1'], 
//         groupId: '120363025737216061@g.us',
//         generate: 'RDE',
//         versi: '2'
//     },
//     { 
//         time: '02 16 * * *', 
//         message: 'Kirim Taksasi SLE  Jam 4 sore', 
//         regions: ['Wilayah_1'], 
//         groupId: '120363025737216061@g.us',
//         generate: 'SLE',
//         versi: '2'
//     },
//     { 
//         time: '04 16 * * *', 
//         message: 'Kirim Taksasi KNE  Jam 4 sore', 
//         regions: ['Wilayah_1'], 
//         groupId: '120363025737216061@g.us',
//         generate: 'KNE',
//         versi: '2'
//     },
//     { 
//         time: '06 16 * * *', 
//         message: 'Kirim Taksasi PLE  Jam 4 sore', 
//         regions: ['Wilayah_1'], 
//         groupId: '120363025737216061@g.us',
//         generate: 'PLE',
//         versi: '2'
//     },
//     { 
//         time: '08 16 * * *', 
//         message: 'Kirim Taksasi SGE  Jam 4 sore', 
//         regions: ['Wilayah_2'], 
//         groupId: '120363047670143778@g.us',
//         generate: 'SGE',
//         versi: '2'
//     },
//     { 
//         time: '10 16 * * *', 
//         message: 'Kirim Taksasi RGE  Jam 4 sore', 
//         regions: ['Wilayah_2'], 
//         groupId: '120363047670143778@g.us',
//         generate: 'RGE',
//         versi: '2'
//     },
//     { 
//         time: '12 16 * * *', 
//         message: 'Kirim Taksasi KDE  Jam 4 sore', 
//         regions: ['Wilayah_2'], 
//         groupId: '120363047670143778@g.us',
//         generate: 'KDE',
//         versi: '2'
//     },
//     { 
//         time: '14 16 * * *', 
//         message: 'Kirim Taksasi BTE  Jam 4 sore', 
//         regions: ['Wilayah_2'], 
//         groupId: '120363047670143778@g.us',
//         generate: 'BTE',
//         versi: '2'
//     },
//     { 
//         time: '16 16 * * *', 
//         message: 'Kirim Taksasi NBE  Jam 4 sore', 
//         regions: ['Wilayah_2'], 
//         groupId: '120363048442215265@g.us',
//         generate: 'NBE',
//         versi: '2'
//     },
//     { 
//         time: '18 16 * * *', 
//         message: 'Kirim Taksasi SYE  Jam 4 sore', 
//         regions: ['Wilayah_2'], 
//         groupId: '120363048442215265@g.us',
//         generate: 'SYE',
//         versi: '2'
//     },
//     { 
//         time: '20 16 * * *', 
//         message: 'Kirim Taksasi BGE  Jam 4 sore', 
//         regions: ['Wilayah_2'], 
//         groupId: '120363048442215265@g.us',
//         generate: 'BGE',
//         versi: '2'
//     },
//     { 
//         time: '00 17 * * *', 
//         message: 'Kirim Taksasi UPE  Jam 5 sore', 
//         regions: ['Wilayah_2'], 
//         groupId: '120363048442215265@g.us',
//         generate: 'UPE',
//         versi: '2'
//     },
// ];tasks.forEach(task => {
//     cron.schedule(task.time, async () => {
//         console.log(`Sending files at ${task.time} (WIB)...`);
//         await sock.sendMessage(idgroup, { text: `Cronjob ${task.message}`})
//         try {
//             // const groupChat = await client.getChatById('120363205553012899@g.us');
//             if (groupChat) {
//                 // await sock.sendMessage(idgroup, { text: 'Kirim cronjob' + task.message})
//                 // await groupChat.sendMessage(task.message);
//                 console.log(`Message sent to the group successfully!`);
//             } else {
//                 console.log(`Group not found!`);
//             }
//         } catch (error) {
//             console.error('Error sending message in cronjob:', error);
//             // logError(error);
//         }
       
//         try {
//             await checkAndDeleteFiles(); 
//             await Generatedmapsest(task.generate,datetimeValue);
//             await GenDefaultTaksasi(task.generate);
//             for (const region of task.regions) {
//                 await sendPdfToGroups(region, task.groupId); // Use task.groupId for all regions
//             }
//         } catch (error) {
//             console.error('Error performing task in cronjob:', error);
//         }
//     }, {
//         scheduled: true,
//         timezone: 'Asia/Jakarta' // Set the timezone to Asia/Jakarta for WIB
//     });
// });




connectToWhatsApp()
    .catch(err => console.log("unexpected error: " + err)) // catch any errors
server.listen(port, () => {
    console.log("Server Berjalan pada Port : " + port);
});
