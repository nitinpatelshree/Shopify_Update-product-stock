import { useState, useCallback } from "react";
import {
  Heading,
  FormLayout,
  TextField,
  Stack,
  RadioButton,
  Button,
  DropZone,
  Thumbnail,
  ButtonGroup
} from "@shopify/polaris";
import {NoteMinor} from '@shopify/polaris-icons';
import { useAuthenticatedFetch } from "../hooks";
import "../stockUpdate.css";
import {BeatLoader} from "react-spinners";
import hmacsha1 from 'hmacsha1';
import _ from 'lodash';
import { Cron } from 'react-js-cron';
import 'react-js-cron/dist/styles.css';


export function StockUpdate() {
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("");
  const [validationErr, setValidationErr] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [csvArray, setCsvArray] = useState([]);
  const [cronValue, setCronValue] = useState('* * * * *')
  
  const fetch = useAuthenticatedFetch();

  const reloadPage = () => {
    window.location.reload()
  }

  //get API data
  async function apiData(metafield)  {
    let date = new Date();
    let api_key = 'c5448e16f478ff6be0bcccb5e86108dc';
    let user_key = 'f7fef1d3d4aaa688d33f323f210ceff3';
    let auth = 'GETproducts/?search='+metafield+'/'+user_key+date.toISOString();
    var hash = hmacsha1(api_key, auth);

    let api_url = 'https://api.b2b.nod.ro/products/?search='+metafield;
    
    const options = {
      method: 'GET',
      headers: {
        'X-NodWS-Date': date.toISOString(),
        'X-NodWS-User': user_key,
        'X-NodWS-Auth': hash,
        'X-NodWS-Accept': 'application/json'
         
      },
    }; 
    let apiDataJson = await fetch('https://cors-anywhere.herokuapp.com/'+api_url,options);
    
    apiDataJson = await apiDataJson.json();
    apiDataJson = apiDataJson.result.products;
    return apiDataJson;
  }


  //get XML data
  const xmlData = async (url) => {
    let alefData = await fetch(`https://cors-anywhere.herokuapp.com/${url}`,
    {
      method: 'get',
      headers: {
        'Content-Type': 'application/xml'
      }
    }
    );
    alefData = await alefData.text();
    alefData=  new DOMParser().parseFromString(alefData, 'application/xml');
    var alefProductDataArray = [];
    for (var i = 0; i < alefData.getElementsByTagName('product').length; i++) {
      let alefProductCode = alefData.getElementsByTagName('product')[i].getElementsByTagName('code')[0].textContent;
      let alefProductEan = alefData.getElementsByTagName('product')[i].getElementsByTagName('ean')[0].textContent;
      let alefProductStock = alefData.getElementsByTagName('product')[i].getElementsByTagName('stock')[0].textContent;
      let alefProductData = `{
            "code": "${alefProductCode}",
            "ean": "${alefProductEan}",
            "stock_value": "${alefProductStock}"
        }
      `;
      alefProductDataArray.push(alefProductData);
    }
    let alefProductsJson = `[
      ${alefProductDataArray}
    ]
    `;
    return JSON.parse(alefProductsJson);
  }

  //get CSV data
  const handleDropZoneDrop = useCallback(
    (_dropFiles, acceptedFiles, _rejectedFiles) =>
    setFileUrl((fileUrl) => acceptedFiles[0]),
    [],
  );

  const fileUpload = !fileUrl && <DropZone.FileUpload />;
  const uploadedFile = fileUrl && (
    <Stack>
      <Thumbnail
        size="small"
        alt={fileUrl.name}
        source={NoteMinor}
      />
      <div className="csv-file-name">
        {fileUrl.name}
      </div>
    </Stack>
  );
  const processCSV = (str, delim=',') => {
    const headers = str.slice(0,str.indexOf('\n')).split(delim);
    const rows = str.slice(str.indexOf('\n')+1).split('\n');

    const newArray = rows.map( row => {
        const values = row.split(delim);
        const eachObject = headers.reduce((obj, header, i) => {
            obj[header] = values[i];
            return obj;
        }, {})
        return eachObject;
    })
    newArray.pop();
    let finalArray = newArray;
    setCsvArray(finalArray)
  }
  const csvData = () => { 
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        processCSV(text);
    }
    reader.readAsText(fileUrl);
    return csvArray; 
  }
  if(fileUrl && fileType == 'csv'){ 
    csvData();
  }

  //get new stock by metafield
  const getProductStockByMetafield = (metafield, array) => {
    const matchedProduct = array.filter((product) => product.code === metafield || product.ean === metafield);
  
    return matchedProduct.length > 0 ? matchedProduct[0].stock_value : 'not match';
  };

  //Stock Update Action
  async function setStock() {
    if((!fileUrl && fileType == 'csv') || (!fileUrl && fileType == 'xml')){
      setValidationErr(true);
      return false;
    }
    if(fileUrl  || fileType) {
      setIsLoading(true);

      let allProducts = await fetch(`/api/products/list/shop`);
      allProducts = await allProducts.json();
      for (let product of allProducts) {
        let productId = parseInt(product.id);
        let getProductById = await fetch(`/api/product/shop/${productId}`);
        getProductById = await getProductById.json();
        let productObject = getProductById.data.product;
        for(let variant of productObject.variants.nodes) {
          if(variant.metafield){
            let metafieldValue = variant.metafield.value;
            let inventoryItemId = parseInt((variant.inventoryItem.id).replace('gid://shopify/InventoryItem/',''));
            let trackedStatus = variant.inventoryItem.tracked;
            let newStock;

            if(fileType == "api"){
              var apiDataJson = await apiData(metafieldValue);
              newStock = getProductStockByMetafield(metafieldValue, apiDataJson);
            } else if( fileUrl  && fileType == "xml"){
              // xml=  http://alef.nssweb.ro/feed.xml?key=04b062e9c43d08ddcf7fcd431f6f65f0
              var xmlDataJson = await xmlData(fileUrl);
              newStock = getProductStockByMetafield(metafieldValue, xmlDataJson);
            } else if( fileUrl  && fileType == "csv"){
              var csvDataJson = await csvData();
              newStock = getProductStockByMetafield(metafieldValue, csvDataJson);
            }else {
              setIsLoading(false);
              setValidationErr(true);
              return false;
            }
            
            if(newStock !== "not match"){
              
              if(!trackedStatus) {
                await fetch(`/api/inventory_items/trackedStatus/${inventoryItemId}`);
              }
              for(let inventoryLevel of variant.inventoryItem.inventoryLevels.nodes){
                let locationId = parseInt((inventoryLevel.location.id).replace('gid://shopify/Location/',''));
                let setNewStock = await fetch(`/api/inventory_levels/stock/set/${inventoryItemId}/${locationId}/${parseInt(newStock)}`);
                setNewStock = await setNewStock.json();
                setIsLoading(false);
                setSuccessMsg(true);
              }
            } 
          } 
        }
      }
    }
  }

  return (
    <>
      <Heading>Stock Update Form</Heading>
      {validationErr && !successMsg && <p className="error-message">Select below fields</p>}
      {successMsg && <p className="success-message">Stock Successfully Updated</p>}
      <FormLayout>
        {fileType ==='csv' ? 
        <DropZone allowMultiple={false} onDrop={handleDropZoneDrop} label="Add CSV file">
          {uploadedFile}
          {fileUpload}
        </DropZone>
        : fileType ==='xml' ?
        <TextField label="Add URL" value={fileUrl} onChange={(e) => setFileUrl(e)} autoComplete="off" />
        : <input type='hidden' value='api'/>
        }
        
        <Stack vertical>
        <RadioButton
            label="API"
            helpText="No URL Required for API"
            checked={fileType === 'api'}
            id="api"
            name="urlType"
            onChange={(_checked, e) => setFileType(e)}
          />
          <RadioButton
          label="XML"
          helpText="Add XML URL"
          checked={fileType === 'xml'}
          id="xml"
          name="urlType"
          onChange={(_checked, e) => setFileType(e)}
          />
          <RadioButton
            label="CSV"
            helpText="Add CSV File"
            checked={fileType === 'csv'}
            id="csv"
            name="urlType"
            onChange={(_checked, e) => setFileType(e)}
          />
        </Stack>
        {/*<Cron value={cronValue} setValue={setCronValue} />*/}
        <ButtonGroup>
          <Button onClick={setStock} disabled={isLoading}>
            {isLoading ? <BeatLoader color="#36d7b7" /> : 'Update Product Quantity'}
          </Button>
          <Button onClick={reloadPage} disabled={isLoading}>
            Reset
          </Button>
        </ButtonGroup>
      </FormLayout>
    </>
  );
}
