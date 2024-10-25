// EditModal.js
import React, { useEffect, useState } from 'react';
import { SketchPicker } from 'react-color';
import Modal from '../Modal/Modal.js';
import { uploadData, getUrl } from '@aws-amplify/storage'; // Import specific functions
import awsConfig from '../../services/aws-exports';

const EditModal = ({ ad, scheduledDateTime, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    content: {
      title: '',
      description: '',
      s3Bucket: '',
      s3Key: '',
    },
    styles: {
      font: 'Arial',
      fontSize: '14px',
      textColor: '#000000',
      borderColor: '#000000',
    },
  });
  const [scheduledTime, setScheduledTime] = useState(
    scheduledDateTime || new Date().toISOString().slice(0, 16)
  );
  const [file, setFile] = useState(null); // For new uploads
  const [mediaUrl, setMediaUrl] = useState(''); // For existing media

  useEffect(() => {
    if (ad && ad.content) {
      setFormData({
        content: {
          title: ad.content.title || '',
          description: ad.content.description || '',
          s3Bucket: ad.content.s3Bucket || '',
          s3Key: ad.content.s3Key || '',
        },
        styles: ad.styles || {
          font: 'Arial',
          fontSize: '14px',
          textColor: '#000000',
          borderColor: '#000000',
        },
      });

      // If editing an existing media ad, fetch the media URL for preview
      if ((ad.type === 'image' || ad.type === 'video') && ad.content.s3Key) {
        getUrl(ad.content.s3Key)
          .then((url) => setMediaUrl(url))
          .catch((error) => console.error('Error fetching media URL:', error));
      }
    }
  }, [ad]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      content: {
        ...prevData.content,
        [name]: value,
      },
    }));
  };

  const handleStyleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      styles: {
        ...prevData.styles,
        [name]: value,
      },
    }));
  };

  const handleColorChange = (color, field) => {
    setFormData((prevData) => ({
      ...prevData,
      styles: {
        ...prevData.styles,
        [field]: color.hex,
      },
    }));
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile); // Store the file for preview

    try {
      const s3Key = `media/${Date.now()}-${selectedFile.name}`;
      await uploadData(s3Key, selectedFile, {
        contentType: selectedFile.type,
      });

      // Access bucket name from awsConfig or define it directly
      const s3Bucket = awsConfig.aws_user_files_s3_bucket; // Adjust as per your aws-exports.js

      setFormData((prevData) => ({
        ...prevData,
        content: {
          ...prevData.content,
          s3Bucket: s3Bucket,
          s3Key: s3Key,
        },
      }));

      // Fetch the URL of the newly uploaded file for preview
      const uploadedUrl = await getUrl(s3Key);
      setMediaUrl(uploadedUrl);

      alert('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    }
  };

  const handleSave = () => {
    // Construct the ad object
    const updatedAd = {
      ...ad,
      content: {
        ...formData.content,
      },
      styles: {
        ...formData.styles,
      },
    };

    // Pass the updated ad data and scheduled time back to the parent component
    onSave(updatedAd, scheduledTime);
    onClose();
  };

  return (
    <Modal isOpen={!!ad} onClose={onClose}>
      <h3>Edit {ad.type} Ad</h3>

      <input
        name="title"
        type="text"
        value={formData.content.title}
        onChange={handleInputChange}
        placeholder="Title"
      />
      <textarea
        name="description"
        value={formData.content.description}
        onChange={handleInputChange}
        placeholder="Description"
      />

      {ad.type === 'text' && (
        <>
          {/* Text ad-specific fields */}
          <input
            name="font"
            type="text"
            value={formData.styles.font}
            onChange={handleStyleChange}
            placeholder="Font Family (e.g., Arial)"
          />
          <input
            name="fontSize"
            type="text"
            value={formData.styles.fontSize}
            onChange={handleStyleChange}
            placeholder="Font Size (e.g., 14px)"
          />
          <label>Text Color:</label>
          <SketchPicker
            color={formData.styles.textColor}
            onChange={(color) => handleColorChange(color, 'textColor')}
          />
        </>
      )}

      {(ad.type === 'image' || ad.type === 'video') && (
        <>
          {/* Media ad-specific fields */}
          <input
            type="file"
            accept={ad.type + '/*'}
            onChange={handleFileUpload}
          />

          {/* Existing Media Preview */}
          {mediaUrl && (
            <div style={{ marginTop: '10px' }}>
              {ad.type === 'image' ? (
                <img
                  src={mediaUrl}
                  alt="Existing Media"
                  style={{ maxWidth: '100%' }}
                />
              ) : (
                <video controls style={{ width: '100%' }}>
                  <source src={mediaUrl} type={file ? file.type : 'video/mp4'} />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          )}

          {/* New File Preview */}
          {file && (
            <div style={{ marginTop: '10px' }}>
              {ad.type === 'image' ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt="Preview"
                  style={{ maxWidth: '100%' }}
                />
              ) : (
                <video controls style={{ width: '100%' }}>
                  <source src={URL.createObjectURL(file)} type={file.type} />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          )}
        </>
      )}

      {/* Common fields */}
      <label>Border Color:</label>
      <SketchPicker
        color={formData.styles.borderColor}
        onChange={(color) => handleColorChange(color, 'borderColor')}
      />

      {/* Scheduled time input */}
      <label style={{ display: 'block', marginTop: '10px' }}>
        Scheduled Date and Time:
        <input
          type="datetime-local"
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
          style={{ display: 'block', marginTop: '5px' }}
        />
      </label>

      <div style={{ marginTop: '20px' }}>
        <button onClick={handleSave} style={{ marginRight: '10px' }}>
          Save
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
};

export default EditModal;
