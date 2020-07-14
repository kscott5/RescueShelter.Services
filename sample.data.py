import random
import datetime
import uuid
import pymongo

word_size_min = 5
word_size_max = 10
wordSize = random.randint(word_size_min, word_size_max)

word_generator = random.sample #Saves the sample([],k=0) function for use later
wordTemplate =  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    
def loadSponsorTestData() :
    print('Load Sponsor Test not implemented yet')

def loadAnimalTestData() :
    print('Loading sample animal data')

    animalCategoryType_choice = random.choice
    animalCategoryTypes = ['fishes', 'amphibians', 'reptiles', 'birds', 'mammals', 'invertebrates']

    endangeredTypes_choice = random.choice #Saves the choice([]) function for use later
    endangeredTypes = [ True, False]

    size_min = 100
    size_max = 500
    population_generator = random.randint(size_min,size_max) #Saves the randint(min,max) function for use later

    description = '''Lorem ipsum dōlor sit ǽmet, reqūe tation constiÞuto vis eu, est ðōlor omnīum āntiopæm ei. 
                    Zril domīng cū eam, hās ið equīðem explīcærī voluptǽtum. Iusto regiōnē partiendo meǣ ne, vim 
                    cu ælii āltērum vōlutpāt, vis et aliquip trītæni. Dolor luptātum sapienÞem cu pēr, dico qūæs 
                    ðissentiǣs et eūm, vix ut.'''

    client = pymongo.MongoClient("localhost", 27017)
    db = client.get_database("rescueshelter")

    col = db.get_collection("animals")
    col.insert_many([
        {
            '_id': str(uuid.uuid4()),
            'name': ''.join(word_generator(wordTemplate, wordSize)),
            'description': description,
            'imageSrc': '',
            'category': animalCategoryType_choice(animalCategoryTypes),
            'endangered': endangeredTypes_choice(endangeredTypes),
            'population': population_generator,
            'dates': {
                'created': datetime.datetime.utcnow(),
                'modified': datetime.datetime.utcnow()
            }
        } for i in range(100000)])

    client.close()

def main() :
    loadSponsorTestData()
    loadAnimalTestData()

if __name__ == "__main__":
    main()