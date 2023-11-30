//
//  StateAllocatePoints.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class StateAllocatePoints: FFPlayState {
    private var selectedFamilyIndex: Int?
    
    private var question: Question?
    
    private var families: FamilyCollection
    
    internal init(families: FamilyCollection) {
        self.families = families
        super.init(type: FFPlayStateType.ALLOCATE_POINTS)
    }
    
    public override func initState(data: Any) {
        var d: [Any] = data as! [Any]
        self.question = d[0] as? Question
        self.selectedFamilyIndex = d[1] as? Int
        
        var total: Int = 0
        
        for answer in self.question!.getAnswers() {
            if (answer.isRevealed()) { total += answer.getValue() * question!.getMultiplier() }
        }
        
        self.question!.setAnswered(answered: true)
        
        self.families.getFamily(index: self.selectedFamilyIndex!).addPoints(amount: total)
        
        //TODO: Logger
        print("Added \(total) points to the \(self.families.getFamily(index: self.selectedFamilyIndex!).getName()) family (\(families.getFamily(index: self.selectedFamilyIndex!).getPoints()) total)")
    }
    
    public override func cleanupState() { self.data = question }
}
